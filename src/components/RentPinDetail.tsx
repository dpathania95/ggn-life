'use client';

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
}

export default function RentPinDetail({ pin, onClose }: RentPinDetailProps) {
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

        {pin.description && <p className="text-sm text-stone-600">{pin.description}</p>}
      </div>
    </div>
  );
}
