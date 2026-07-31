'use client';

interface DropChooserProps {
  onCancel: () => void;
  onChooseRentPin: () => void;
  onChooseListing: () => void;
  onChooseSeekerPin: () => void;
}

// Tap-to-drop entry point (spec Section 3.7) — three-way branch into the
// anonymous rent-pin flow, the email-gated listing flow, or the seeker-pin
// want-ad flow (tapped location becomes the seeker's matching anchor point).
export default function DropChooser({
  onCancel,
  onChooseRentPin,
  onChooseListing,
  onChooseSeekerPin,
}: DropChooserProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">What are you sharing?</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onChooseRentPin}
            className="rounded-xl border border-stone-300 p-4 text-left transition hover:border-stone-400"
          >
            <p className="text-sm font-medium text-stone-900">What I pay</p>
            <p className="text-xs text-stone-500">
              Anonymous, 30 seconds — no email needed
            </p>
          </button>

          <button
            type="button"
            onClick={onChooseListing}
            className="rounded-xl border border-stone-300 p-4 text-left transition hover:border-stone-400"
          >
            <p className="text-sm font-medium text-stone-900">List a flat or room</p>
            <p className="text-xs text-stone-500">
              Zero brokerage — email needed for match notifications only
            </p>
          </button>

          <button
            type="button"
            onClick={onChooseSeekerPin}
            className="rounded-xl border border-stone-300 p-4 text-left transition hover:border-stone-400"
          >
            <p className="text-sm font-medium text-stone-900">Find a flat or flatmate</p>
            <p className="text-xs text-stone-500">
              We&apos;ll match you daily — email needed to get matches
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
