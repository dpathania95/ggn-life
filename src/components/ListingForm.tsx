'use client';

import { useState } from 'react';
import {
  FURNISHING_VALUES,
  LISTING_TYPE_VALUES,
  RENT_BHK_VALUES,
  Furnishing,
  ListingType,
  NewListingInput,
  RentBhk,
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

interface ListingFormProps {
  lat: number;
  lng: number;
  onCancel: () => void;
  onSubmit: (input: Omit<NewListingInput, 'lat' | 'lng'>) => Promise<void>;
}

export default function ListingForm({ lat, lng, onCancel, onSubmit }: ListingFormProps) {
  const [type, setType] = useState<ListingType>('whole_flat');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [bhk, setBhk] = useState<RentBhk>('2');
  const [furnishing, setFurnishing] = useState<Furnishing>('semi');
  const [gated, setGated] = useState(false);
  const [parking, setParking] = useState(false);
  const [availableFrom, setAvailableFrom] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rentValue = Number(rent);
    const depositValue = Number(deposit);
    if (!rent || !Number.isFinite(rentValue) || rentValue <= 0) {
      setError('Enter a valid monthly rent.');
      return;
    }
    if (!deposit || !Number.isFinite(depositValue) || depositValue < 0) {
      setError('Enter a valid deposit amount.');
      return;
    }
    if (!availableFrom) {
      setError('Pick an availability date.');
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      setError('A valid email is required — used only for match notifications, never shown publicly.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        rent: rentValue,
        deposit: depositValue,
        bhk,
        furnishing,
        gated,
        parking,
        available_from: availableFrom,
        description: description.trim() || null,
        contact_email: contactEmail.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">List a flat or room</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-stone-500">
          {lat.toFixed(5)}, {lng.toFixed(5)} — exact location, not rounded
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Listing type</label>
          <div className="flex flex-wrap gap-2">
            {LISTING_TYPE_VALUES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  type === t
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {LISTING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rent" className="mb-1.5 block text-sm font-medium text-stone-700">
              Monthly rent (₹)
            </label>
            <input
              id="rent"
              type="number"
              min={1}
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              placeholder="e.g. 42000"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="deposit" className="mb-1.5 block text-sm font-medium text-stone-700">
              Deposit (₹)
            </label>
            <input
              id="deposit"
              type="number"
              min={0}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="e.g. 100000"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">BHK</label>
          <div className="flex flex-wrap gap-2">
            {RENT_BHK_VALUES.map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => setBhk(b)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  bhk === b
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {BHK_LABELS[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Furnishing</label>
          <div className="flex flex-wrap gap-2">
            {FURNISHING_VALUES.map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFurnishing(f)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  furnishing === f
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {FURNISHING_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={gated}
              onChange={(e) => setGated(e.target.checked)}
              className="accent-brand-600"
            />
            Gated society
          </label>
          <label className="flex items-center gap-1.5 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={parking}
              onChange={(e) => setParking(e.target.checked)}
              className="accent-brand-600"
            />
            Parking available
          </label>
        </div>

        <div className="mb-4">
          <label htmlFor="available_from" className="mb-1.5 block text-sm font-medium text-stone-700">
            Available from
          </label>
          <input
            id="available_from"
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-stone-700">
            Description <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. 10 min walk to metro, vegetarian society"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-stone-400">{description.length}/500</p>
        </div>

        <div className="mb-5">
          <label htmlFor="contact_email" className="mb-1.5 block text-sm font-medium text-stone-700">
            Your email
          </label>
          <input
            id="contact_email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-stone-400">
            Never shown publicly — used only to notify you of matches and to manage this listing.
          </p>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post listing'}
        </button>
      </form>
    </div>
  );
}
