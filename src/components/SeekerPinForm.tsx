'use client';

import { useEffect, useState } from 'react';
import {
  FOOD_PREF_VALUES,
  GENDER_PREF_VALUES,
  RENT_BHK_VALUES,
  SMOKING_PREF_VALUES,
  FoodPref,
  GenderPref,
  NewSeekerPinInput,
  RentBhk,
  SmokingPref,
  Zone,
} from '@/types/rental';

const BHK_LABELS: Record<RentBhk, string> = {
  '1': '1 BHK',
  '2': '2 BHK',
  '3': '3 BHK',
  '4_plus': '4+ BHK',
};

const GENDER_PREF_LABELS: Record<GenderPref, string> = {
  male: 'Male',
  female: 'Female',
};

const SMOKING_PREF_LABELS: Record<SmokingPref, string> = {
  smoker: 'Smoker',
  non_smoker: 'Non-smoker',
};

const FOOD_PREF_LABELS: Record<FoodPref, string> = {
  veg: 'Veg',
  non_veg: 'Non-veg',
};

interface SeekerPinFormProps {
  lat: number;
  lng: number;
  onCancel: () => void;
  onSubmit: (input: Omit<NewSeekerPinInput, 'lat' | 'lng'>) => Promise<void>;
}

export default function SeekerPinForm({ lat, lng, onCancel, onSubmit }: SeekerPinFormProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [bhk, setBhk] = useState<RentBhk>('2');
  const [preferredZoneIds, setPreferredZoneIds] = useState<string[]>([]);
  const [moveInBy, setMoveInBy] = useState('');
  const [genderPref, setGenderPref] = useState<GenderPref | null>(null);
  const [smokingPref, setSmokingPref] = useState<SmokingPref | null>(null);
  const [foodPref, setFoodPref] = useState<FoodPref | null>(null);
  const [petOwner, setPetOwner] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.json())
      .then((data: { zones: Zone[] }) => setZones(data.zones))
      .catch(() => setError('Failed to load zones — try again in a moment.'));
  }, []);

  const toggleZone = (id: string) => {
    setPreferredZoneIds((prev) => (prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const budgetMinValue = Number(budgetMin);
    const budgetMaxValue = Number(budgetMax);
    if (!budgetMin || !Number.isFinite(budgetMinValue) || budgetMinValue <= 0) {
      setError('Enter a valid minimum budget.');
      return;
    }
    if (!budgetMax || !Number.isFinite(budgetMaxValue) || budgetMaxValue < budgetMinValue) {
      setError('Max budget must be at least the min budget.');
      return;
    }
    if (preferredZoneIds.length === 0) {
      setError('Pick at least one preferred area.');
      return;
    }
    if (!moveInBy) {
      setError('Pick a move-in-by date.');
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      setError('A valid email is required — used only for match notifications, never shown publicly.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        budget_min: budgetMinValue,
        budget_max: budgetMaxValue,
        bhk,
        preferred_zone_ids: preferredZoneIds,
        move_in_by: moveInBy,
        gender_pref: genderPref,
        smoking_pref: smokingPref,
        food_pref: foodPref,
        pet_owner: petOwner,
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
          <h2 className="text-lg font-semibold text-stone-900">Find a flat or flatmate</h2>
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
          {lat.toFixed(5)}, {lng.toFixed(5)} — used only as a matching anchor, not shown publicly
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="budget_min" className="mb-1.5 block text-sm font-medium text-stone-700">
              Min budget (₹)
            </label>
            <input
              id="budget_min"
              type="number"
              min={1}
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="e.g. 25000"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="budget_max" className="mb-1.5 block text-sm font-medium text-stone-700">
              Max budget (₹)
            </label>
            <input
              id="budget_max"
              type="number"
              min={1}
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="e.g. 45000"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">BHK needed</label>
          <div className="flex flex-wrap gap-2">
            {RENT_BHK_VALUES.map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => setBhk(b)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  bhk === b
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {BHK_LABELS[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            Preferred area(s) <span className="text-stone-400">(pick at least one)</span>
          </label>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {zones.length === 0 && !error && (
              <p className="text-xs text-stone-400">Loading areas…</p>
            )}
            {zones.map((zone) => (
              <button
                type="button"
                key={zone.id}
                onClick={() => toggleZone(zone.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  preferredZoneIds.includes(zone.id)
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="move_in_by" className="mb-1.5 block text-sm font-medium text-stone-700">
            Move in by
          </label>
          <input
            id="move_in_by"
            type="date"
            value={moveInBy}
            onChange={(e) => setMoveInBy(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            Lifestyle preferences <span className="text-stone-400">(optional, affects ranking not eligibility)</span>
          </label>

          <div className="mb-2 flex flex-wrap gap-2">
            {GENDER_PREF_VALUES.map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => setGenderPref((prev) => (prev === g ? null : g))}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  genderPref === g
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {GENDER_PREF_LABELS[g]} flatmate
              </button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {SMOKING_PREF_VALUES.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSmokingPref((prev) => (prev === s ? null : s))}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  smokingPref === s
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {SMOKING_PREF_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {FOOD_PREF_VALUES.map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFoodPref((prev) => (prev === f ? null : f))}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  foodPref === f
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {FOOD_PREF_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-sm text-stone-700">
            <input type="checkbox" checked={petOwner} onChange={(e) => setPetOwner(e.target.checked)} />
            I have a pet
          </label>
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
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-stone-400">
            Never shown publicly — used only to send matches and to manage this search.
          </p>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Start matching'}
        </button>
      </form>
    </div>
  );
}
