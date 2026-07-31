// Rough Gurgaon bounding box — rejects wildly out-of-area pins/listings.
export const GURGAON_BOUNDS = { minLat: 27.9, maxLat: 28.7, minLng: 76.7, maxLng: 77.3 };

export function isInGurgaonBounds(lat: number, lng: number): boolean {
  return (
    lat > GURGAON_BOUNDS.minLat &&
    lat < GURGAON_BOUNDS.maxLat &&
    lng > GURGAON_BOUNDS.minLng &&
    lng < GURGAON_BOUNDS.maxLng
  );
}

// Placeholder plausibility ranges per BHK (₹/month, spec Section 4) — not
// tuned against real data yet; adjust once there's real usage to calibrate.
// Shared by rent pins and listings, per spec Section 4's "rent pins/listings".
export const RENT_PLAUSIBILITY_RANGE: Record<string, [number, number]> = {
  '1': [5000, 60000],
  '2': [8000, 120000],
  '3': [12000, 250000],
  '4_plus': [18000, 600000],
};
