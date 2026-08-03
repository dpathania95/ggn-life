'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_FILTERS, FilterState, LayerVisibility } from '@/lib/filterPins';
import {
  FURNISHING_VALUES,
  LISTING_TYPE_VALUES,
  RENT_BHK_VALUES,
  Furnishing,
  ListingType,
  RentBhk,
  Zone,
} from '@/types/rental';

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

const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  whole_flat: 'Whole flat',
  room_flatmate: 'Room (flatmate)',
};

interface FilterPanelProps {
  layers: LayerVisibility;
  onLayersChange: (layers: LayerVisibility) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClose: () => void;
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function FilterPanel({
  layers,
  onLayersChange,
  filters,
  onFiltersChange,
  onClose,
}: FilterPanelProps) {
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.json())
      .then((data: { zones: Zone[] }) => setZones(data.zones ?? []))
      .catch(() => setZones([]));
  }, []);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Filters</h2>
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
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Show on map</label>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={layers.rentPins}
                onChange={(e) => onLayersChange({ ...layers, rentPins: e.target.checked })}
              />
              What people pay
            </label>
            <label className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={layers.listings}
                onChange={(e) => onLayersChange({ ...layers, listings: e.target.checked })}
              />
              Listings
            </label>
            <label className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={layers.seekerPins}
                onChange={(e) => onLayersChange({ ...layers, seekerPins: e.target.checked })}
              />
              Seekers
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            BHK <span className="text-stone-400">(applies to rent pins &amp; listings)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {RENT_BHK_VALUES.map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => onFiltersChange({ ...filters, bhk: toggleInArray(filters.bhk, b) })}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  filters.bhk.includes(b)
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {BHK_LABELS[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="min_rent" className="mb-1.5 block text-sm font-medium text-stone-700">
              Min rent (₹)
            </label>
            <input
              id="min_rent"
              type="number"
              min={0}
              value={filters.minRent ?? ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, minRent: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="No min"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="max_rent" className="mb-1.5 block text-sm font-medium text-stone-700">
              Max rent (₹)
            </label>
            <input
              id="max_rent"
              type="number"
              min={0}
              value={filters.maxRent ?? ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, maxRent: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="No max"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Furnishing</label>
          <div className="flex flex-wrap gap-2">
            {FURNISHING_VALUES.map((f) => (
              <button
                type="button"
                key={f}
                onClick={() =>
                  onFiltersChange({ ...filters, furnishing: toggleInArray(filters.furnishing, f) })
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  filters.furnishing.includes(f)
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {FURNISHING_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Gated society</label>
            <div className="flex gap-2">
              {(['any', 'yes', 'no'] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => onFiltersChange({ ...filters, gated: v })}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                    filters.gated === v
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 text-stone-700 hover:border-stone-400'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Parking</label>
            <div className="flex gap-2">
              {(['any', 'yes', 'no'] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => onFiltersChange({ ...filters, parking: v })}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                    filters.parking === v
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 text-stone-700 hover:border-stone-400'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            Listing type <span className="text-stone-400">(listings only)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {LISTING_TYPE_VALUES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() =>
                  onFiltersChange({ ...filters, listingType: toggleInArray(filters.listingType, t) })
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  filters.listingType.includes(t)
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {LISTING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Area</label>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {zones.map((zone) => (
              <button
                type="button"
                key={zone.id}
                onClick={() =>
                  onFiltersChange({ ...filters, zoneIds: toggleInArray(filters.zoneIds, zone.id) })
                }
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  filters.zoneIds.includes(zone.id)
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          className="w-full rounded-lg border border-stone-300 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}
