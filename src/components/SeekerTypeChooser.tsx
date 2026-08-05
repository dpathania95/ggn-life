'use client';

import { Home, Users } from 'lucide-react';
import { SeekerType } from '@/types/rental';

interface SeekerTypeChooserProps {
  onSelect: (type: SeekerType) => void;
  onCancel: () => void;
}

// Second branching step for seeker pins (spec Section 3.3/3.7) — shown
// after the map tap, before the type-appropriate form.
export default function SeekerTypeChooser({ onSelect, onCancel }: SeekerTypeChooserProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Full flat, or a flatmate?</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelect('full_flat')}
            className="flex flex-col items-center gap-2 rounded-xl border border-stone-300 px-4 py-6 text-center transition hover:border-brand-500 hover:bg-brand-50"
          >
            <Home className="h-6 w-6 text-stone-700" />
            <span className="text-sm font-medium text-stone-900">A full flat</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect('flatmate')}
            className="flex flex-col items-center gap-2 rounded-xl border border-stone-300 px-4 py-6 text-center transition hover:border-brand-500 hover:bg-brand-50"
          >
            <Users className="h-6 w-6 text-stone-700" />
            <span className="text-sm font-medium text-stone-900">A flatmate</span>
          </button>
        </div>
      </div>
    </div>
  );
}
