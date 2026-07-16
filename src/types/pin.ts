export const CATEGORIES = ['cafe', 'park', 'hangout', 'hidden_gem', 'food'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  cafe: 'Cafe',
  park: 'Park',
  hangout: 'Hangout',
  hidden_gem: 'Hidden Gem',
  food: 'Food',
};

export const TAGS = [
  'good_for_work',
  'cheap',
  'rooftop_outdoor',
  'metro_accessible',
  'pet_friendly',
  'late_night',
  'aesthetic',
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  good_for_work: 'Good for work',
  cheap: 'Cheap',
  rooftop_outdoor: 'Rooftop / Outdoor',
  metro_accessible: 'Metro-accessible',
  pet_friendly: 'Pet-friendly',
  late_night: 'Late night',
  aesthetic: 'Aesthetic',
};

export interface Pin {
  id: string;
  category: Category;
  name: string;
  one_liner: string;
  tags: Tag[];
  photo_url: string | null;
  photo_hidden: boolean;
  lat: number;
  lng: number;
  upvotes: number;
  downvotes: number;
  photo_upvotes: number;
  photo_downvotes: number;
  created_at: string;
}

export interface NewPinInput {
  category: Category;
  name: string;
  one_liner: string;
  tags: Tag[];
  photo_url?: string | null;
  lat: number;
  lng: number;
}
