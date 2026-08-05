import { Furnishing, Listing, ListingType, RentBhk, RentPin, SeekerPin } from '@/types/rental';

export interface FilterState {
  bhk: RentBhk[];
  minRent: number | null;
  maxRent: number | null;
  furnishing: Furnishing[];
  gated: 'any' | 'yes' | 'no';
  parking: 'any' | 'yes' | 'no';
  zoneIds: string[];
  listingType: ListingType[];
}

// Layer toggle (spec Section 3.9) — separate from FilterState since it's a
// show/hide switch per pin type, not a narrowing filter within a type.
export interface LayerVisibility {
  rentPins: boolean;
  listings: boolean;
  seekerPins: boolean;
}

export const DEFAULT_LAYERS: LayerVisibility = {
  rentPins: true,
  listings: true,
  seekerPins: true,
};

export const DEFAULT_FILTERS: FilterState = {
  bhk: [],
  minRent: null,
  maxRent: null,
  furnishing: [],
  gated: 'any',
  parking: 'any',
  zoneIds: [],
  listingType: [],
};

// Shared BHK/budget/furnishing/gated/parking/zone checks (spec Section 3.9:
// "Filters that apply to rent pins and listings alike"). Filtering happens
// client-side against the already viewport-bounded fetch, not server-side —
// result sets are small (capped at 500 by the *_in_bounds RPCs).
function matchesCoreFilters(
  filters: FilterState,
  core: { bhk: RentBhk; rent: number; furnishing: Furnishing; gated: boolean; parking: boolean; zoneId: string | null }
): boolean {
  if (filters.bhk.length > 0 && !filters.bhk.includes(core.bhk)) return false;
  if (filters.minRent != null && core.rent < filters.minRent) return false;
  if (filters.maxRent != null && core.rent > filters.maxRent) return false;
  if (filters.furnishing.length > 0 && !filters.furnishing.includes(core.furnishing)) return false;
  if (filters.gated !== 'any' && core.gated !== (filters.gated === 'yes')) return false;
  if (filters.parking !== 'any' && core.parking !== (filters.parking === 'yes')) return false;
  if (filters.zoneIds.length > 0 && (!core.zoneId || !filters.zoneIds.includes(core.zoneId))) return false;
  return true;
}

export function matchesRentPinFilters(filters: FilterState, pin: RentPin): boolean {
  return matchesCoreFilters(filters, {
    bhk: pin.bhk,
    rent: pin.rent,
    furnishing: pin.furnishing,
    gated: pin.gated,
    parking: pin.need_parking,
    zoneId: pin.zone_id,
  });
}

export function matchesListingFilters(filters: FilterState, listing: Listing): boolean {
  if (filters.listingType.length > 0 && !filters.listingType.includes(listing.type)) return false;
  return matchesCoreFilters(filters, {
    bhk: listing.bhk,
    rent: listing.rent,
    furnishing: listing.furnishing,
    gated: listing.gated,
    parking: listing.parking,
    zoneId: listing.zone_id,
  });
}

// Seeker pins reuse the same filter fields (spec Section 3.9: "Filters that
// apply to rent pins, listings, and seeker pins alike") but can't reuse
// matchesCoreFilters directly — budget is a range, not a single rent value,
// and BHK/furnishing/gated/parking are full_flat-only (n/a for flatmate
// pins, which pass through those checks untouched rather than being
// excluded). A full_flat pin that left a preference unset (null) hasn't
// ruled anything out either, so it also passes through that check.
export function matchesSeekerPinFilters(filters: FilterState, pin: SeekerPin): boolean {
  const isFullFlat = pin.seeker_type === 'full_flat';

  if (isFullFlat && filters.bhk.length > 0 && (!pin.bhk || !filters.bhk.includes(pin.bhk))) return false;

  // Budget range overlap, not a single-value check (spec 3.9: "budget range (min–max)").
  if (filters.minRent != null && pin.budget_max < filters.minRent) return false;
  if (filters.maxRent != null && pin.budget_min > filters.maxRent) return false;

  if (isFullFlat) {
    if (
      filters.furnishing.length > 0 &&
      pin.furnishing_pref &&
      !filters.furnishing.includes(pin.furnishing_pref)
    ) {
      return false;
    }
    if (filters.gated !== 'any' && pin.gated_pref != null && pin.gated_pref !== (filters.gated === 'yes')) {
      return false;
    }
    if (
      filters.parking !== 'any' &&
      pin.parking_pref != null &&
      pin.parking_pref !== (filters.parking === 'yes')
    ) {
      return false;
    }
  }

  // Zone filter checks the seeker's preferred_zone_ids (what they're
  // looking for), not their anchor pin's own zone_id — more useful for
  // someone browsing seeker pins by area.
  if (filters.zoneIds.length > 0 && !pin.preferred_zone_ids.some((z) => filters.zoneIds.includes(z))) {
    return false;
  }

  return true;
}
