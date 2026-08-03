import { Furnishing, Listing, ListingType, RentBhk, RentPin } from '@/types/rental';

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
