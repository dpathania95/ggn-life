import { NextRequest, NextResponse } from 'next/server';
import { nominatimThrottle } from '@/lib/ratelimit';
import { GURGAON_BOUNDS } from '@/lib/rentalConstants';

// Identifies this app to Nominatim per its usage policy — required, not
// decorative. Update the contact if this ships to a real domain/inbox.
const NOMINATIM_USER_AGENT = 'ggn.life/0.1 (https://ggn.life)';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// GET /api/geocode?q=<query>
// Server-side proxy to Nominatim (spec Section 3.8) — the browser never
// calls Nominatim directly, both to respect its 1 req/sec global usage
// policy (enforced here via nominatimThrottle, shared across all callers)
// and its requirement for a real identifying User-Agent.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { success } = await nominatimThrottle.limit('global');
  if (!success) {
    return NextResponse.json({ error: 'Search is busy, try again in a moment' }, { status: 429 });
  }

  // Biases/restricts results toward Gurgaon rather than a true hard filter —
  // viewbox is left,top,right,bottom = minLng,maxLat,maxLng,minLat.
  const viewbox = `${GURGAON_BOUNDS.minLng},${GURGAON_BOUNDS.maxLat},${GURGAON_BOUNDS.maxLng},${GURGAON_BOUNDS.minLat}`;
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}` +
    `&viewbox=${viewbox}&bounded=1&countrycodes=in&limit=5`;

  let nominatimRes: Response;
  try {
    nominatimRes = await fetch(url, { headers: { 'User-Agent': NOMINATIM_USER_AGENT } });
  } catch (err) {
    console.error('Nominatim request failed:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 502 });
  }

  if (!nominatimRes.ok) {
    return NextResponse.json({ error: 'Search failed' }, { status: 502 });
  }

  const data: NominatimResult[] = await nominatimRes.json();
  const results = data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));

  return NextResponse.json({ results });
}
