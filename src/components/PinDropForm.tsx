'use client';

import { useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS, TAGS, TAG_LABELS, Category, Tag } from '@/types/pin';

interface PinDropFormProps {
  lat: number;
  lng: number;
  onCancel: () => void;
  onSubmit: (input: {
    category: Category;
    name: string;
    one_liner: string;
    tags: Tag[];
  }) => Promise<void>;
}

export default function PinDropForm({ lat, lng, onCancel, onSubmit }: PinDropFormProps) {
  const [category, setCategory] = useState<Category>('cafe');
  const [name, setName] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: Tag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !oneLiner.trim()) {
      setError('Name and one-liner are both required.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ category, name: name.trim(), one_liner: oneLiner.trim(), tags });
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
          <h2 className="text-lg font-semibold text-stone-900">What&apos;s here?</h2>
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
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  category === c
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-stone-700">
            Place name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Third Wave Coffee, Sector 29"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="one_liner" className="mb-1.5 block text-sm font-medium text-stone-700">
            Why it&apos;s worth knowing
          </label>
          <input
            id="one_liner"
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            maxLength={100}
            placeholder="e.g. Quiet corner tables, great for laptop work"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-stone-400">{oneLiner.length}/100</p>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            Tags <span className="text-stone-400">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  tags.includes(tag)
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          {submitting ? 'Dropping pin…' : 'Drop pin'}
        </button>
      </form>
    </div>
  );
}
