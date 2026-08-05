'use client';

import { useState } from 'react';
import { Furnishing, RentBhk, SeekerPin } from '@/types/rental';
import InterestModal from './InterestModal';

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

interface SeekerPinDetailProps {
  pin: SeekerPin;
  onClose: () => void;
  onInterest: (email: string) => Promise<void>;
}

// Public view of a seeker want-ad (spec Section 3.9's seeker-pin layer).
// Contact info is never included — only released to a matched party
// (spec Section 3.2/3.3), or right away via the "I'm interested" contact
// request (spec Section 3.10).
export default function SeekerPinDetail({ pin, onClose, onInterest }: SeekerPinDetailProps) {
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interested, setInterested] = useState(false);
  const isFullFlat = pin.seeker_type === 'full_flat';

  const handleInterest = async (email: string) => {
    await onInterest(email);
    setInterested(true);
    setShowInterestModal(false);
  };
  const badges: string[] = [];
  if (isFullFlat) {
    if (pin.furnishing_pref) badges.push(FURNISHING_LABELS[pin.furnishing_pref]);
    if (pin.parking_pref) badges.push('Needs parking');
    if (pin.gated_pref) badges.push('Prefers gated society');
  } else {
    if (pin.gender_pref) badges.push(`${pin.gender_pref === 'male' ? 'Male' : 'Female'} flatmate ok`);
    if (pin.smoking_pref) badges.push(pin.smoking_pref === 'smoker' ? 'Smoker' : 'Non-smoker');
    if (pin.food_pref) badges.push(pin.food_pref === 'veg' ? 'Veg' : 'Non-veg');
    if (pin.pet_owner) badges.push('Has a pet');
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 sm:inset-auto sm:right-4 sm:top-20 sm:w-80">
      <div className="rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-700">
            {isFullFlat && pin.bhk ? `Looking for ${BHK_LABELS[pin.bhk]}` : 'Looking for a flatmate'}
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

        <p className="mb-3 rounded-md bg-stone-50 px-2 py-1.5 text-xs text-stone-500">
          Contact info is shared only if matched — got a place that fits? List it to be considered.
        </p>

        <div className="border-t border-stone-100 pt-3">
          {interested ? (
            <p className="text-xs text-stone-500">Thanks — they&apos;ve been notified.</p>
          ) : (
            <button
              onClick={() => setShowInterestModal(true)}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              I&apos;m interested
            </button>
          )}
        </div>
      </div>

      {showInterestModal && (
        <InterestModal onSubmit={handleInterest} onCancel={() => setShowInterestModal(false)} />
      )}
    </div>
  );
}
