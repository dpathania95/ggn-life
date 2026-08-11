'use client';

import { useEffect, useState } from 'react';
import { Furnishing, RentBhk, RentPin, Zone } from '@/types/rental';

const BHK_LABELS: Record<RentBhk, string> = {
  '1': '1 BHK',
  '2': '2 BHK',
  '3': '3 BHK',
  '4_plus': '4+ BHK',
};

const FURNISHING_LABELS: Record<Furnishing, string> = {
  unfurnished: 'Unfurnished',
  semi: 'Semi-furnished',
  fully: 'Fully furnished',
};

// "Posted 3 days ago" — inspired by bengaluru.rent's "Pinned 118d ago",
// using created_at, which was already stored but never surfaced here.
function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

interface RentPinDetailProps {
  pin: RentPin;
  onClose: () => void;
  onReport: () => Promise<void>;
}

export default function RentPinDetail({ pin, onClose, onReport }: RentPinDetailProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolves zone_id (already stored on every pin) to a display name —
  // same fetch-all-zones pattern used by FilterPanel/SeekerPinForm.
  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.json())
      .then((data: { zones: Zone[] }) => setZones(data.zones ?? []))
      .catch(() => setZones([]));
  }, []);

  const zoneName = zones.find((z) => z.id === pin.zone_id)?.name;

  const handleReport = async () => {
    setError(null);
    setReporting(true);
    try {
      await onReport();
      setReported(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
            {BHK_LABELS[pin.bhk]}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer text-stone-400 hover:text-stone-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Monthly rent</p>
        <h3 className="mb-1 text-xl font-semibold text-stone-900">
          ₹{pin.rent.toLocaleString('en-IN')}
          <span className="text-sm font-normal text-stone-500">/month</span>
        </h3>

        {zoneName && <p className="mb-2 text-xs text-stone-500">📍 {zoneName}</p>}

        {pin.is_outlier && (
          <p className="mb-3 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            ⚠ Unverified — well outside the typical rent for this area/BHK
          </p>
        )}

        <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-stone-600">
          <span className="rounded-full bg-stone-100 px-2 py-0.5">{pin.area_sqft} sq ft</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5">{FURNISHING_LABELS[pin.furnishing]}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5">
            {pin.gated ? 'Gated society' : 'Independent'}
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5">
            {pin.need_parking ? 'Parking available' : 'No parking'}
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5">
            {pin.maintenance_included ? 'Maintenance included' : 'Maintenance extra'}
          </span>
          {pin.floor != null && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5">Floor {pin.floor}</span>
          )}
        </div>

        {pin.description && (
          <p className="mb-3 border-l-2 border-stone-200 pl-2 text-sm italic text-stone-600">
            &ldquo;{pin.description}&rdquo;
          </p>
        )}

        <p className="mb-3 text-xs text-stone-400">Posted {timeAgo(pin.created_at)}</p>

        <div className="flex items-center justify-between border-t border-stone-100 pt-3">
          {reported ? (
            <p className="text-xs text-stone-500">Thanks — this has been reported.</p>
          ) : (
            <button
              onClick={handleReport}
              disabled={reporting}
              className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
            >
              {reporting ? 'Reporting…' : 'Report (wrong info, spam, closed)'}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
