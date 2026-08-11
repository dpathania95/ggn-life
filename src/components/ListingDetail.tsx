'use client';

import { useEffect, useState } from 'react';
import { Furnishing, Listing, RentBhk, Zone } from '@/types/rental';
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

interface ListingDetailProps {
  listing: Listing;
  onClose: () => void;
  onInterest: (email: string) => Promise<void>;
}

// Contact info is deliberately absent — never shown on the map or listing
// card, only released to a matched seeker (spec Section 3.2), or right
// away via the "I'm interested" contact request (spec Section 3.10).
export default function ListingDetail({ listing, onClose, onInterest }: ListingDetailProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interested, setInterested] = useState(false);

  // Resolves zone_id (already stored on every listing) to a display name —
  // same fetch-all-zones pattern used by FilterPanel/SeekerPinForm.
  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.json())
      .then((data: { zones: Zone[] }) => setZones(data.zones ?? []))
      .catch(() => setZones([]));
  }, []);

  const zoneName = zones.find((z) => z.id === listing.zone_id)?.name;

  const handleInterest = async (email: string) => {
    await onInterest(email);
    setInterested(true);
    setShowInterestModal(false);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {listing.type === 'whole_flat' ? 'Whole flat' : 'Room (flatmate)'}
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
          ₹{listing.rent.toLocaleString('en-IN')}
          <span className="text-sm font-normal text-stone-500">/month</span>
        </h3>

        {zoneName && <p className="mb-2 text-xs text-stone-500">📍 {zoneName}</p>}

        <p className="mb-3 text-xs text-stone-500">
          Deposit ₹{listing.deposit.toLocaleString('en-IN')} · Available from{' '}
          {new Date(listing.available_from).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
        </p>

        <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-stone-600">
          <span className="rounded-full bg-stone-100 px-2 py-0.5">{BHK_LABELS[listing.bhk]}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5">{FURNISHING_LABELS[listing.furnishing]}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5">
            {listing.gated ? 'Gated society' : 'Independent'}
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5">
            {listing.parking ? 'Parking available' : 'No parking'}
          </span>
        </div>

        {listing.description && (
          <p className="mb-3 border-l-2 border-stone-200 pl-2 text-sm italic text-stone-600">
            &ldquo;{listing.description}&rdquo;
          </p>
        )}

        <p className="mb-3 text-xs text-stone-400">Posted {timeAgo(listing.created_at)}</p>

        <p className="mb-3 rounded-md bg-stone-50 px-2 py-1.5 text-xs text-stone-500">
          Contact info is shared only if you&apos;re matched — post a &ldquo;seeker&rdquo; want-ad to get considered.
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
