'use client';

import { Furnishing, Listing, RentBhk } from '@/types/rental';

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

interface ListingDetailProps {
  listing: Listing;
  onClose: () => void;
}

// Contact info is deliberately absent — never shown on the map or listing
// card, only released to a matched seeker (spec Section 3.2).
export default function ListingDetail({ listing, onClose }: ListingDetailProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 sm:inset-auto sm:right-4 sm:top-20 sm:w-80">
      <div className="rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {listing.type === 'whole_flat' ? 'Whole flat' : 'Room (flatmate)'}
          </span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="mb-1 text-xl font-semibold text-stone-900">
          ₹{listing.rent.toLocaleString('en-IN')}
          <span className="text-sm font-normal text-stone-500">/month</span>
        </h3>
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

        {listing.description && <p className="mb-3 text-sm text-stone-600">{listing.description}</p>}

        <p className="rounded-md bg-stone-50 px-2 py-1.5 text-xs text-stone-500">
          Contact info is shared only if you&apos;re matched — post a &ldquo;seeker&rdquo; want-ad to get considered.
        </p>
      </div>
    </div>
  );
}
