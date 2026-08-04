'use client';

import { useEffect, useState } from 'react';
import { AreaStats as AreaStatsData, RentBhk, Zone } from '@/types/rental';

const BHK_LABELS: Record<RentBhk, string> = {
  '1': '1 BHK',
  '2': '2 BHK',
  '3': '3 BHK',
  '4_plus': '4+ BHK',
};

interface AreaStatsProps {
  onClose: () => void;
}

// Area rent stats (spec Section 3.5) — "the single most shareable feature
// in this layer." Zone picker + Share button, deliberately no map-tap
// gesture here since tapping the map already means "drop a pin" (spec 3.7).
export default function AreaStats({ onClose }: AreaStatsProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [stats, setStats] = useState<AreaStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.json())
      .then((data: { zones: Zone[] }) => setZones(data.zones ?? []))
      .catch(() => setError('Failed to load areas — try again in a moment.'));
  }, []);

  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setStats(null);
    setShared(false);
    setError(null);
    setLoading(true);
    fetch(`/api/area-stats?zoneId=${zoneId}`)
      .then((res) => res.json())
      .then((data: AreaStatsData) => setStats(data))
      .catch(() => setError('Failed to load stats for this area.'))
      .finally(() => setLoading(false));
  };

  const shareText = (() => {
    if (!stats) return '';
    const lines = stats.byBhk.map(
      (b) => `${BHK_LABELS[b.bhk]}: ₹${b.avgRent.toLocaleString('en-IN')}/mo (${b.count} pins)`
    );
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    return `📊 ${stats.zone.name} rent stats (via ggn.life):\n${lines.join('\n')}\n\nSee more: ${url}`;
  })();

  const handleShare = async () => {
    if (!stats) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${stats.zone.name} rent stats`, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      setShared(true);
    } catch {
      // User cancelled the native share sheet, or the browser blocked it —
      // not an error worth surfacing.
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Area rent stats</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Pick an area</label>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {zones.map((zone) => (
              <button
                type="button"
                key={zone.id}
                onClick={() => handleSelectZone(zone.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  selectedZoneId === zone.id
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-sm text-stone-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {stats && !loading && (
          <div className="rounded-xl bg-stone-50 p-4">
            <h3 className="mb-1 text-base font-semibold text-stone-900">{stats.zone.name}</h3>
            <p className="mb-3 text-xs text-stone-500">
              Based on {stats.totalPins} anonymous rent pin{stats.totalPins === 1 ? '' : 's'}
            </p>

            {stats.byBhk.length === 0 ? (
              <p className="text-sm text-stone-500">No rent pins here yet.</p>
            ) : (
              <div className="mb-4 flex flex-col gap-2">
                {stats.byBhk.map((b) => (
                  <div key={b.bhk} className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">{BHK_LABELS[b.bhk]}</span>
                    <span className="font-medium text-stone-900">
                      ₹{b.avgRent.toLocaleString('en-IN')}/mo
                      <span className="ml-1 text-xs font-normal text-stone-400">({b.count})</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {stats.byBhk.length > 0 && (
              <button
                type="button"
                onClick={handleShare}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                {shared ? 'Shared!' : 'Share'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
