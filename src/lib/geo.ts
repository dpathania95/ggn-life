// Rounds a coordinate to ~100m precision (3 decimal places ≈ 111m at the
// equator) — used to fuzz rent-pin locations before storage (spec Section
// 3.1/4), since an exact point reveals something close to a home address.
export function roundCoordinate(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
