'use client';

import { useEffect, useState } from 'react';
import { Furnishing, RentBhk, SeekerPin, Zone } from '@/types/rental';
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

// Seeker pins auto-expire 30 days after posting (spec Section 3.3) —
// expires_at was already stored but never surfaced, even though it's a
// direct signal of how live/fresh this want-ad still is.
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

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
  const [zones, setZones] = useState<Zone[]>([]);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interested, setInterested] = useState(false);
  const isFullFlat = pin.seeker_type === 'full_flat';

  // Resolves preferred_zone_ids (already stored, never surfaced) to names —
  // this is what the seeker is actually looking in, unlike zone_id, which
  // is just the anchor pin's own location (spec: "matched by preferred
  // area, not pin location" — see FilterPanel's Area filter hint).
  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.json())
      .then((data: { zones: Zone[] }) => setZones(data.zones ?? []))
      .catch(() => setZones([]));
  }, []);

  const preferredZoneNames = pin.preferred_zone_ids
    .map((id) => zones.find((z) => z.id === id)?.name)
    .filter((name): name is string => Boolean(name));

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
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-700">
            {isFullFlat && pin.bhk ? `Looking for ${BHK_LABELS[pin.bhk]}` : 'Looking for a flatmate'}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer text-stone-400 hover:text-stone-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Budget</p>
        <h3 className="mb-1 text-xl font-semibold text-stone-900">
          ₹{pin.budget_min.toLocaleString('en-IN')}–{pin.budget_max.toLocaleString('en-IN')}
          <span className="text-sm font-normal text-stone-500">/month</span>
        </h3>

        {preferredZoneNames.length > 0 && (
          <p className="mb-2 text-xs text-stone-500">📍 Looking in {preferredZoneNames.join(', ')}</p>
        )}

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

        <p className="mb-3 text-xs text-stone-400">
          Posted {timeAgo(pin.created_at)} · Expires in {Math.max(daysUntil(pin.expires_at), 0)} days
        </p>

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
