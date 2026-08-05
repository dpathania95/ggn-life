'use client';

import { useState } from 'react';
import { Furnishing, RentBhk, RentPin } from '@/types/rental';

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

interface RentPinDetailProps {
  pin: RentPin;
  onClose: () => void;
  onReport: () => Promise<void>;
}

export default function RentPinDetail({ pin, onClose, onReport }: RentPinDetailProps) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-x-0 bottom-0 z-20 sm:inset-auto sm:right-4 sm:top-20 sm:w-80">
      <div className="rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
            {BHK_LABELS[pin.bhk]}
          </span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="mb-1 text-xl font-semibold text-stone-900">
          ₹{pin.rent.toLocaleString('en-IN')}
          <span className="text-sm font-normal text-stone-500">/month</span>
        </h3>

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
          {pin.floor != null && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5">Floor {pin.floor}</span>
          )}
        </div>

        {pin.description && <p className="mb-3 text-sm text-stone-600">{pin.description}</p>}

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
