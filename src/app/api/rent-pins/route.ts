import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rentPinCreateLimiter, hashIp, getClientIp } from '@/lib/ratelimit';
import { roundCoordinate } from '@/lib/geo';
import { isInGurgaonBounds, RENT_PLAUSIBILITY_RANGE } from '@/lib/rentalConstants';
import { RENT_BHK_VALUES, FURNISHING_VALUES, NewRentPinInput } from '@/types/rental';

// Outlier flag threshold — 3x+ above/below the local (zone + BHK) median (spec Section 4)
const OUTLIER_MULTIPLIER = 3;

// GET /api/rent-pins?minLng=&minLat=&maxLng=&maxLat=
// Loads rent pins within the current map viewport via the rent_pins_in_bounds RPC.
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

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('rent_pins_in_bounds', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
  });

  if (error) {
    console.error('Failed to load rent_pins:', JSON.stringify(error));
    return NextResponse.json({ error: 'Failed to load rent pins' }, { status: 500 });
  }

  return NextResponse.json({ rentPins: data });
}

// POST /api/rent-pins — create a rent pin. Fully anonymous, no email,
// rate-limited to 1 per IP per day (spec Section 3.1/4).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success } = await rentPinCreateLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Daily rent pin limit reached. Try again tomorrow.' },
      { status: 429 }
    );
  }

  let body: NewRentPinInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    rent,
    area_sqft,
    bhk,
    furnishing,
    gated,
    floor,
    description,
    need_parking,
    maintenance_included,
    lat,
    lng,
  } = body;

  // Server-side validation — never trust the client, especially with no auth layer.
  if (!RENT_BHK_VALUES.includes(bhk)) {
    return NextResponse.json({ error: 'Invalid bhk' }, { status: 400 });
  }
  if (!FURNISHING_VALUES.includes(furnishing)) {
    return NextResponse.json({ error: 'Invalid furnishing' }, { status: 400 });
  }
  if (typeof rent !== 'number' || !Number.isFinite(rent) || rent <= 0) {
    return NextResponse.json({ error: 'rent must be a positive number' }, { status: 400 });
  }
  if (typeof area_sqft !== 'number' || !Number.isFinite(area_sqft) || area_sqft <= 0) {
    return NextResponse.json({ error: 'area_sqft must be a positive number' }, { status: 400 });
  }
  const [minRent, maxRent] = RENT_PLAUSIBILITY_RANGE[bhk];
  if (rent < minRent || rent > maxRent) {
    return NextResponse.json(
      { error: `rent must be between ${minRent} and ${maxRent} for ${bhk} BHK` },
      { status: 400 }
    );
  }
  if (typeof gated !== 'boolean') {
    return NextResponse.json({ error: 'gated must be a boolean' }, { status: 400 });
  }
  if (typeof need_parking !== 'boolean') {
    return NextResponse.json({ error: 'need_parking must be a boolean' }, { status: 400 });
  }
  if (typeof maintenance_included !== 'boolean') {
    return NextResponse.json({ error: 'maintenance_included must be a boolean' }, { status: 400 });
  }
  if (floor !== undefined && floor !== null && !Number.isInteger(floor)) {
    return NextResponse.json({ error: 'floor must be an integer' }, { status: 400 });
  }
  if (description != null && description.length > 500) {
    return NextResponse.json(
      { error: 'description must be at most 500 characters' },
      { status: 400 }
    );
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat/lng must be numbers' }, { status: 400 });
  }
  if (!isInGurgaonBounds(lat, lng)) {
    return NextResponse.json({ error: 'Location must be within Gurgaon' }, { status: 400 });
  }

  // Coordinates rounded to ~100m before storage (spec Section 3.1) — unlike
  // discovery pins, an exact rent-pin location is close to someone's home.
  const roundedLat = roundCoordinate(lat);
  const roundedLng = roundCoordinate(lng);

  const supabase = createAdminClient();
  const { data: inserted, error: insertError } = await supabase
    .from('rent_pins')
    .insert({
      rent,
      area_sqft,
      bhk,
      furnishing,
      gated,
      floor: floor ?? null,
      description: description?.trim() || null,
      need_parking,
      maintenance_included,
      lat: roundedLat,
      lng: roundedLng,
      ip_hash: hashIp(ip),
    })
    .select()
    .single();

  if (insertError || !inserted) {
    console.error('Failed to insert rent_pin:', JSON.stringify(insertError));
    return NextResponse.json({ error: 'Failed to create rent pin' }, { status: 500 });
  }

  // Outlier flagging — 3x+ above/below the local (zone + BHK) median (spec
  // Section 4). zone_id is only known after insert (DB-assigned via the
  // nearest-centroid trigger), so this is a follow-up pass, not part of the
  // initial insert.
  if (inserted.zone_id) {
    const { data: peers } = await supabase
      .from('rent_pins')
      .select('rent')
      .eq('zone_id', inserted.zone_id)
      .eq('bhk', bhk)
      .eq('hidden', false)
      .neq('id', inserted.id);

    if (peers && peers.length > 0) {
      const sorted = peers.map((p) => p.rent).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

      const isOutlier = rent >= median * OUTLIER_MULTIPLIER || rent <= median / OUTLIER_MULTIPLIER;
      if (isOutlier) {
        await supabase.from('rent_pins').update({ is_outlier: true }).eq('id', inserted.id);
        inserted.is_outlier = true;
      }
    }
  }

  return NextResponse.json({ rentPin: inserted }, { status: 201 });
}
