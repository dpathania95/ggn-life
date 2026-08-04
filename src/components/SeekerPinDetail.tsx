'use client';

import { RentBhk, SeekerPin } from '@/types/rental';

const BHK_LABELS: Record<RentBhk, string> = {
  '1': '1 BHK',
  '2': '2 BHK',
  '3': '3 BHK',
  '4_plus': '4+ BHK',
};

interface SeekerPinDetailProps {
  pin: SeekerPin;
  onClose: () => void;
}

// Public view of a seeker want-ad (spec Section 3.9's seeker-pin layer).
// Contact info is never included — only released to a matched party
// (spec Section 3.2/3.3).
export default function SeekerPinDetail({ pin, onClose }: SeekerPinDetailProps) {
  const badges: string[] = [];
  if (pin.gender_pref) badges.push(`${pin.gender_pref === 'male' ? 'Male' : 'Female'} flatmate ok`);
  if (pin.smoking_pref) badges.push(pin.smoking_pref === 'smoker' ? 'Smoker' : 'Non-smoker');
  if (pin.food_pref) badges.push(pin.food_pref === 'veg' ? 'Veg' : 'Non-veg');
  if (pin.pet_owner) badges.push('Has a pet');

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 sm:inset-auto sm:right-4 sm:top-20 sm:w-80">
      <div className="rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-700">
            Looking for {BHK_LABELS[pin.bhk]}
          </span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="mb-1 text-xl font-semibold text-stone-900">
          ₹{pin.budget_min.toLocaleString('en-IN')}–{pin.budget_max.toLocaleString('en-IN')}
          <span className="text-sm font-normal text-stone-500">/month</span>
        </h3>
        <p className="mb-3 text-xs text-stone-500">
          Move in by{' '}
          {new Date(pin.move_in_by).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>

        {badges.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-stone-600">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-stone-100 px-2 py-0.5">
                {b}
              </span>
            ))}
          </div>
        )}

        <p className="rounded-md bg-stone-50 px-2 py-1.5 text-xs text-stone-500">
          Contact info is shared only if matched — got a place that fits? List it to be considered.
        </p>
      </div>
    </div>
  );
}
