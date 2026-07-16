import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { pinCreateLimiter, hashIp, getClientIp } from '@/lib/ratelimit';
import { CATEGORIES, TAGS, NewPinInput } from '@/types/pin';

// GET /api/pins?minLng=&minLat=&maxLng=&maxLat=
// Loads pins within the current map viewport via the pins_in_bounds RPC.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minLng = parseFloat(searchParams.get('minLng') ?? '');
  const minLat = parseFloat(searchParams.get('minLat') ?? '');
  const maxLng = parseFloat(searchParams.get('maxLng') ?? '');
  const maxLat = parseFloat(searchParams.get('maxLat') ?? '');

  if ([minLng, minLat, maxLng, maxLat].some(Number.isNaN)) {
    return NextResponse.json(
      { error: 'minLng, minLat, maxLng, maxLat are required query params' },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc('pins_in_bounds', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load pins' }, { status: 500 });
  }

  return NextResponse.json({ pins: data });
}

// POST /api/pins — create a new pin. Anonymous, no auth required,
// but rate-limited by IP per the spec's anti-abuse section.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success, remaining } = await pinCreateLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Daily pin limit reached. Try again tomorrow.' },
      { status: 429 }
    );
  }

  let body: NewPinInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { category, name, one_liner, tags, photo_url, lat, lng } = body;

  // Server-side validation — never trust the client, especially with no auth layer.
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (!name || name.trim().length === 0 || name.length > 80) {
    return NextResponse.json({ error: 'Name must be 1-80 characters' }, { status: 400 });
  }
  if (!one_liner || one_liner.trim().length === 0 || one_liner.length > 100) {
    return NextResponse.json({ error: 'One-liner must be 1-100 characters' }, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.some((t) => !TAGS.includes(t))) {
    return NextResponse.json({ error: 'Invalid tags' }, { status: 400 });
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat/lng must be numbers' }, { status: 400 });
  }
  // Rough Gurgaon bounding box — rejects wildly out-of-area pins.
  const inGurgaonBounds = lat > 27.9 && lat < 28.7 && lng > 76.7 && lng < 77.3;
  if (!inGurgaonBounds) {
    return NextResponse.json({ error: 'Location must be within Gurgaon' }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('pins')
    .insert({
      category,
      name: name.trim(),
      one_liner: one_liner.trim(),
      tags,
      photo_url: photo_url ?? null,
      lat,
      lng,
      ip_hash: hashIp(ip),
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create pin' }, { status: 500 });
  }

  return NextResponse.json({ pin: data, remaining }, { status: 201 });
}
