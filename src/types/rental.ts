export const RENT_BHK_VALUES = ['1', '2', '3', '4_plus'] as const;
export type RentBhk = (typeof RENT_BHK_VALUES)[number];

export const FURNISHING_VALUES = ['unfurnished', 'semi', 'fully'] as const;
export type Furnishing = (typeof FURNISHING_VALUES)[number];

export interface RentPin {
  id: string;
  rent: number;
  area_sqft: number;
  bhk: RentBhk;
  furnishing: Furnishing;
  gated: boolean;
  floor: number | null;
  description: string | null;
  need_parking: boolean;
  maintenance_included: boolean;
  lat: number;
  lng: number;
  zone_id: string | null;
  reports: number;
  hidden: boolean;
  is_outlier: boolean;
  created_at: string;
}

export interface NewRentPinInput {
  rent: number;
  area_sqft: number;
  bhk: RentBhk;
  furnishing: Furnishing;
  gated: boolean;
  floor?: number | null;
  description?: string | null;
  need_parking: boolean;
  maintenance_included: boolean;
  lat: number;
  lng: number;
}

export const LISTING_TYPE_VALUES = ['whole_flat', 'room_flatmate'] as const;
export type ListingType = (typeof LISTING_TYPE_VALUES)[number];

export const LISTING_STATUS_VALUES = ['active', 'rented'] as const;
export type ListingStatus = (typeof LISTING_STATUS_VALUES)[number];

export interface Listing {
  id: string;
  type: ListingType;
  rent: number;
  deposit: number;
  bhk: RentBhk;
  furnishing: Furnishing;
  parking: boolean;
  gated: boolean;
  available_from: string;
  description: string | null;
  lat: number;
  lng: number;
  zone_id: string | null;
  status: ListingStatus;
  created_at: string;
}

export interface NewListingInput {
  type: ListingType;
  rent: number;
  deposit: number;
  bhk: RentBhk;
  furnishing: Furnishing;
  parking: boolean;
  gated: boolean;
  available_from: string;
  description?: string | null;
  contact_email: string;
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  name: string;
}

export interface AreaStatsByBhk {
  bhk: RentBhk;
  avgRent: number;
  count: number;
}

export interface AreaStats {
  zone: Zone;
  totalPins: number;
  byBhk: AreaStatsByBhk[];
}

export const GENDER_PREF_VALUES = ['male', 'female'] as const;
export type GenderPref = (typeof GENDER_PREF_VALUES)[number];

export const SMOKING_PREF_VALUES = ['smoker', 'non_smoker'] as const;
export type SmokingPref = (typeof SMOKING_PREF_VALUES)[number];

export const FOOD_PREF_VALUES = ['veg', 'non_veg'] as const;
export type FoodPref = (typeof FOOD_PREF_VALUES)[number];

export const SEEKER_STATUS_VALUES = ['active', 'matched', 'expired'] as const;
export type SeekerStatus = (typeof SEEKER_STATUS_VALUES)[number];

export const SEEKER_TYPE_VALUES = ['full_flat', 'flatmate'] as const;
export type SeekerType = (typeof SEEKER_TYPE_VALUES)[number];

export interface SeekerPin {
  id: string;
  seeker_type: SeekerType;
  budget_min: number;
  budget_max: number;
  bhk: RentBhk | null;
  furnishing_pref: Furnishing | null;
  parking_pref: boolean | null;
  gated_pref: boolean | null;
  preferred_zone_ids: string[];
  move_in_by: string;
  gender_pref: GenderPref | null;
  smoking_pref: SmokingPref | null;
  food_pref: FoodPref | null;
  pet_owner: boolean | null;
  lat: number;
  lng: number;
  zone_id: string | null;
  status: SeekerStatus;
  expires_at: string;
  created_at: string;
}

// Kept as a single flat interface (not a discriminated union) — Omit/Pick
// don't distribute over unions, and SeekerPinForm's onSubmit prop is typed
// Omit<NewSeekerPinInput, 'lat' | 'lng'> matching the other forms' convention.
export interface NewSeekerPinInput {
  seeker_type: SeekerType;
  budget_min: number;
  budget_max: number;
  bhk?: RentBhk | null;
  furnishing_pref?: Furnishing | null;
  parking_pref?: boolean | null;
  gated_pref?: boolean | null;
  preferred_zone_ids: string[];
  move_in_by: string;
  gender_pref?: GenderPref | null;
  smoking_pref?: SmokingPref | null;
  food_pref?: FoodPref | null;
  pet_owner?: boolean | null;
  contact_email: string;
  lat: number;
  lng: number;
}
