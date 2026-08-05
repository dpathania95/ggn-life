'use client';

import { useState } from 'react';

interface InterestModalProps {
  onSubmit: (email: string) => Promise<void>;
  onCancel: () => void;
}

// Single-field, no-login contact request (spec Section 3.10) — the
// instant, on-demand counterpart to the daily matching job. No budget/BHK
// gate: the person browsing already made a deliberate, informed choice by
// clicking through to this listing/seeker pin.
export default function InterestModal({ onSubmit, onCancel }: InterestModalProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email so they can reach you.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">I&apos;m interested</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>

        <label htmlFor="interest_email" className="mb-1.5 block text-sm font-medium text-stone-700">
          Enter your email so they can reach you
        </label>
        <input
          id="interest_email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
