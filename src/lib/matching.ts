import { Listing, SeekerPin } from '@/types/rental';

// Not tuned against real data yet (spec Section 8) — placeholder values,
// adjust once there's real usage to calibrate against.
export const MATCH_RADIUS_METERS = 2500;
export const MAX_MATCHES_PER_SEEKER_PER_RUN = 5;

function budgetOverlapsListing(seeker: SeekerPin, listing: Listing): boolean {
  return listing.rent >= seeker.budget_min && listing.rent <= seeker.budget_max;
}

function budgetOverlapsSeeker(a: SeekerPin, b: SeekerPin): boolean {
  return a.budget_min <= b.budget_max && b.budget_min <= a.budget_max;
}

// Hard filter (spec Section 3.3/7) — full_flat seekers only match
// whole_flat listings, and budget+BHK must both clear. Flatmate seekers
// never match listings at all (spec Section 3.4) — the daily job's
// listing path is full_flat-only; a flatmate looking for a room finds one
// via Section 3.10's on-demand "I'm interested" instead.
export function isHardMatchForListing(seeker: SeekerPin, listing: Listing): boolean {
  if (seeker.seeker_type !== 'full_flat') return false;
  if (listing.type !== 'whole_flat') return false;
  return listing.bhk === seeker.bhk && budgetOverlapsListing(seeker, listing);
}

// Hard filter (spec Section 3.4/7) — seeker-to-seeker matching is
// flatmate-only; full_flat seekers never match other seekers (they match
// listings instead, via isHardMatchForListing above). Budget only, no BHK
// check — flatmate pins don't collect BHK (spec Section 3.3).
export function isHardMatchForSeeker(a: SeekerPin, b: SeekerPin): boolean {
  if (a.seeker_type !== 'flatmate' || b.seeker_type !== 'flatmate') return false;
  return budgetOverlapsSeeker(a, b);
}

// Soft ranking (spec Section 3.3/3.4/7) among already hard-filtered
// candidates — flatmate matches only, since full_flat seekers never reach
// this via isHardMatchForSeeker above. Weights deliberately untuned (spec
// Section 8), equal +1 per signal.
//
// gender_pref is intentionally NOT scored here: the spec defines it as a
// preference about a *flatmate's* gender, but SeekerPin has no "own gender"
// field to check a candidate against — a data-model gap, unchanged by the
// seeker-type split. Flagging it rather than fabricating a comparison that
// doesn't actually hold up.
export function seekerPreferenceScore(a: SeekerPin, b: SeekerPin): number {
  let score = 0;
  if (a.food_pref && b.food_pref && a.food_pref === b.food_pref) score += 1;
  if (a.smoking_pref && b.smoking_pref && a.smoking_pref === b.smoking_pref) score += 1;
  if (a.pet_owner === b.pet_owner) score += 1;
  return score;
}
