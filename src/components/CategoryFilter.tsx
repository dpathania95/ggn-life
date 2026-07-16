'use client';

import { CATEGORIES, CATEGORY_LABELS, Category } from '@/types/pin';

interface CategoryFilterProps {
  active: Category | 'all';
  onChange: (category: Category | 'all') => void;
}

export default function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="pointer-events-auto flex gap-2 overflow-x-auto rounded-full bg-white/90 p-1.5 shadow-md backdrop-blur">
      <button
        onClick={() => onChange('all')}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
          active === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
        }`}
      >
        All
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
            active === c ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {CATEGORY_LABELS[c]}
        </button>
      ))}
    </div>
  );
}
