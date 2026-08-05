'use client';

import { useState } from 'react';
import { FURNISHING_VALUES, RENT_BHK_VALUES, Furnishing, NewRentPinInput, RentBhk } from '@/types/rental';

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

interface RentPinFormProps {
  lat: number;
  lng: number;
  onCancel: () => void;
  onSubmit: (input: Omit<NewRentPinInput, 'lat' | 'lng'>) => Promise<void>;
}

interface FieldErrors {
  rent?: string;
  area?: string;
}

export default function RentPinForm({ lat, lng, onCancel, onSubmit }: RentPinFormProps) {
  const [rent, setRent] = useState('');
  const [area, setArea] = useState('');
  const [bhk, setBhk] = useState<RentBhk>('2');
  const [furnishing, setFurnishing] = useState<Furnishing>('semi');
  const [gated, setGated] = useState(false);
  const [needParking, setNeedParking] = useState(false);
  const [floor, setFloor] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rentValue = Number(rent);
    const areaValue = Number(area);
    const errors: FieldErrors = {};

    if (!rent || !Number.isFinite(rentValue) || rentValue <= 0) {
      errors.rent = 'Enter a valid monthly rent.';
    }
    if (!area || !Number.isFinite(areaValue) || areaValue <= 0) {
      errors.area = 'Enter a valid area in sq ft.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        rent: rentValue,
        area_sqft: areaValue,
        bhk,
        furnishing,
        gated,
        need_parking: needParking,
        floor: floor ? Number(floor) : null,
        description: description.trim() || null,
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
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">What do you pay?</h2>
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
          Selected - {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>

        <div className="mb-4">
          <label htmlFor="rent" className="mb-1.5 block text-sm font-medium text-stone-700">
            Monthly rent (₹)
          </label>
          <input
            id="rent"
            type="number"
            min={1}
            value={rent}
            onChange={(e) => {
              setRent(e.target.value);
              setFieldErrors((prev) => ({ ...prev, rent: undefined }));
            }}
            placeholder="e.g. 35000"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {fieldErrors.rent && <p className="mt-1 text-xs text-red-600">{fieldErrors.rent}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="area" className="mb-1.5 block text-sm font-medium text-stone-700">
            Area (sq ft)
          </label>
          <input
            id="area"
            type="number"
            min={1}
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setFieldErrors((prev) => ({ ...prev, area: undefined }));
            }}
            placeholder="e.g. 850"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {fieldErrors.area && <p className="mt-1 text-xs text-red-600">{fieldErrors.area}</p>}
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
              checked={needParking}
              onChange={(e) => setNeedParking(e.target.checked)}
              className="accent-brand-600"
            />
            Parking available
          </label>
        </div>

        <div className="mb-4">
          <label htmlFor="floor" className="mb-1.5 block text-sm font-medium text-stone-700">
            Floor <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="floor"
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="e.g. 3"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="mb-5">
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-stone-700">
            Notes <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. Landlord lives on-site, society has a park"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-stone-400">{description.length}/500</p>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Sharing…' : 'Share anonymously'}
        </button>
      </form>
    </div>
  );
}
