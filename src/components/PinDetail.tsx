'use client';

import { Pin, CATEGORY_LABELS, TAG_LABELS } from '@/types/pin';

interface PinDetailProps {
  pin: Pin;
  onClose: () => void;
  onVote: (target: 'pin' | 'photo', direction: 'up' | 'down') => void;
  onReport: () => void;
}

export default function PinDetail({ pin, onClose, onVote, onReport }: PinDetailProps) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?pin=${pin.id}` : '';

  const handleShare = async () => {
    const text = `${pin.name} — ${pin.one_liner} ${shareUrl}`;
    if (navigator.share) {
      await navigator.share({ title: pin.name, text, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 sm:inset-auto sm:right-4 sm:top-20 sm:w-80">
      <div className="rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
            {CATEGORY_LABELS[pin.category]}
          </span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="mb-1 text-base font-semibold text-stone-900">{pin.name}</h3>
        <p className="mb-3 text-sm text-stone-600">{pin.one_liner}</p>

        {pin.photo_url && !pin.photo_hidden && (
          <div className="mb-3 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pin.photo_url} alt={pin.name} className="h-40 w-full object-cover" />
            <div className="mt-1 flex gap-2 text-xs text-stone-500">
              <button onClick={() => onVote('photo', 'up')}>👍 {pin.photo_upvotes}</button>
              <button onClick={() => onVote('photo', 'down')}>👎 {pin.photo_downvotes}</button>
            </div>
          </div>
        )}

        {pin.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {pin.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
              >
                {TAG_LABELS[tag]}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-stone-100 pt-3">
          <div className="flex gap-3 text-sm">
            <button
              onClick={() => onVote('pin', 'up')}
              className="flex items-center gap-1 text-stone-600 hover:text-emerald-700"
            >
              👍 {pin.upvotes}
            </button>
            <button
              onClick={() => onVote('pin', 'down')}
              className="flex items-center gap-1 text-stone-600 hover:text-red-700"
            >
              👎 {pin.downvotes}
            </button>
          </div>
          <div className="flex gap-3 text-xs text-stone-400">
            <button onClick={handleShare} className="hover:text-stone-700">
              Share
            </button>
            <button onClick={onReport} className="hover:text-red-600">
              Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
