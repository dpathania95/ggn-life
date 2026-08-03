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

// Hard filter (spec Section 7) — budget range and BHK must match, or a
// candidate isn't eligible at all, full stop.
export function isHardMatchForListing(seeker: SeekerPin, listing: Listing): boolean {
  return listing.bhk === seeker.bhk && budgetOverlapsListing(seeker, listing);
}

export function isHardMatchForSeeker(a: SeekerPin, b: SeekerPin): boolean {
  return a.bhk === b.bhk && budgetOverlapsSeeker(a, b);
}

// Soft ranking (spec Section 3.3/7) among already hard-filtered candidates
// — weights are deliberately untuned (spec Section 8), equal +1 per signal.
//
// gender_pref is intentionally NOT scored here: the spec defines it as a
// preference about a *flatmate's* gender, but SeekerPin has no "own gender"
// field to check a candidate against — a data-model gap. Flagging it rather
// than fabricating a comparison that doesn't actually hold up.
export function seekerPreferenceScore(a: SeekerPin, b: SeekerPin): number {
  let score = 0;
  if (a.food_pref && b.food_pref && a.food_pref === b.food_pref) score += 1;
  if (a.smoking_pref && b.smoking_pref && a.smoking_pref === b.smoking_pref) score += 1;
  if (a.pet_owner === b.pet_owner) score += 1;
  return score;
}
