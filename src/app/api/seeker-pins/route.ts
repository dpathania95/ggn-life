import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { seekerPinCreateLimiter, hashIp, getClientIp } from '@/lib/ratelimit';
import { generateManageToken } from '@/lib/manageToken';
import { roundCoordinate } from '@/lib/geo';
import { isInGurgaonBounds } from '@/lib/rentalConstants';
import {
  FOOD_PREF_VALUES,
  GENDER_PREF_VALUES,
  NewSeekerPinInput,
  RENT_BHK_VALUES,
  SMOKING_PREF_VALUES,
} from '@/types/rental';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/seeker-pins?minLng=&minLat=&maxLng=&maxLat=
// Loads active seeker pins within the current map viewport via the
// seeker_pins_in_bounds RPC — a visible/toggleable layer per spec Section
// 3.9. The RPC excludes contact_email/manage_token_hash; this table has no
// public SELECT policy for exactly that reason.
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
  const { data, error } = await supabase.rpc('seeker_pins_in_bounds', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
  });

  if (error) {
    console.error('Failed to load seeker_pins:', JSON.stringify(error));
    return NextResponse.json({ error: 'Failed to load seeker pins' }, { status: 500 });
  }

  return NextResponse.json({ seekerPins: data });
}

// POST /api/seeker-pins — create a seeker want-ad. Requires an email (used
// only for match notifications and the manage link, never shown publicly),
// rate limited to 1 per IP per day (spec Section 3.3/4).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success } = await seekerPinCreateLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Daily seeker pin limit reached. Try again tomorrow.' },
      { status: 429 }
    );
  }

  let body: NewSeekerPinInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    budget_min,
    budget_max,
    bhk,
    preferred_zone_ids,
    move_in_by,
    gender_pref,
    smoking_pref,
    food_pref,
    pet_owner,
    contact_email,
    lat,
    lng,
  } = body;

  // Server-side validation — never trust the client, especially with no auth layer.
  if (typeof budget_min !== 'number' || !Number.isFinite(budget_min) || budget_min <= 0) {
    return NextResponse.json({ error: 'budget_min must be a positive number' }, { status: 400 });
  }
  if (typeof budget_max !== 'number' || !Number.isFinite(budget_max) || budget_max < budget_min) {
    return NextResponse.json(
      { error: 'budget_max must be a number greater than or equal to budget_min' },
      { status: 400 }
    );
  }
  if (!RENT_BHK_VALUES.includes(bhk)) {
    return NextResponse.json({ error: 'Invalid bhk' }, { status: 400 });
  }
  if (!Array.isArray(preferred_zone_ids) || preferred_zone_ids.length === 0) {
    return NextResponse.json({ error: 'preferred_zone_ids must have at least one zone' }, { status: 400 });
  }
  const moveInByDate = new Date(move_in_by);
  if (!move_in_by || Number.isNaN(moveInByDate.getTime())) {
    return NextResponse.json({ error: 'move_in_by must be a valid date' }, { status: 400 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (moveInByDate < today) {
    return NextResponse.json({ error: 'move_in_by cannot be in the past' }, { status: 400 });
  }
  if (gender_pref != null && !GENDER_PREF_VALUES.includes(gender_pref)) {
    return NextResponse.json({ error: 'Invalid gender_pref' }, { status: 400 });
  }
  if (smoking_pref != null && !SMOKING_PREF_VALUES.includes(smoking_pref)) {
    return NextResponse.json({ error: 'Invalid smoking_pref' }, { status: 400 });
  }
  if (food_pref != null && !FOOD_PREF_VALUES.includes(food_pref)) {
    return NextResponse.json({ error: 'Invalid food_pref' }, { status: 400 });
  }
  if (typeof pet_owner !== 'boolean') {
    return NextResponse.json({ error: 'pet_owner must be a boolean' }, { status: 400 });
  }
  if (typeof contact_email !== 'string' || !EMAIL_PATTERN.test(contact_email)) {
    return NextResponse.json({ error: 'A valid contact_email is required' }, { status: 400 });
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat/lng must be numbers' }, { status: 400 });
  }
  if (!isInGurgaonBounds(lat, lng)) {
    return NextResponse.json({ error: 'Location must be within Gurgaon' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // preferred_zone_ids has no DB-level FK (Postgres can't FK into an array
  // column), so validate membership against the real zones table here.
  const uniqueZoneIds = [...new Set(preferred_zone_ids)];
  const { data: matchedZones, error: zonesError } = await supabase
    .from('zones')
    .select('id')
    .in('id', uniqueZoneIds);

  if (zonesError) {
    console.error('Failed to validate preferred_zone_ids:', JSON.stringify(zonesError));
    return NextResponse.json({ error: 'Failed to validate preferred_zone_ids' }, { status: 500 });
  }
  if (!matchedZones || matchedZones.length !== uniqueZoneIds.length) {
    return NextResponse.json({ error: 'One or more preferred_zone_ids are invalid' }, { status: 400 });
  }

  const { token: manageToken, tokenHash } = generateManageToken();

  // Anchor point can be rounded per spec Section 6 — rounding by default for
  // privacy, same as rent pins, since it's discretionary rather than exact.
  const roundedLat = roundCoordinate(lat);
  const roundedLng = roundCoordinate(lng);

  const { data: inserted, error: insertError } = await supabase
    .from('seeker_pins')
    .insert({
      budget_min,
      budget_max,
      bhk,
      preferred_zone_ids: uniqueZoneIds,
      move_in_by,
      gender_pref: gender_pref ?? null,
      smoking_pref: smoking_pref ?? null,
      food_pref: food_pref ?? null,
      pet_owner,
      contact_email: contact_email.trim(),
      manage_token_hash: tokenHash,
      lat: roundedLat,
      lng: roundedLng,
      ip_hash: hashIp(ip),
    })
    .select(
      'id, budget_min, budget_max, bhk, preferred_zone_ids, move_in_by, gender_pref, smoking_pref, food_pref, pet_owner, lat, lng, zone_id, status, expires_at, created_at'
    )
    .single();

  if (insertError || !inserted) {
    console.error('Failed to insert seeker_pin:', JSON.stringify(insertError));
    return NextResponse.json({ error: 'Failed to create seeker pin' }, { status: 500 });
  }

  // manageToken is the raw, one-time value — only its hash is stored. Until
  // email integration exists (spec Section 3.6), it's returned directly here
  // as a stand-in delivery mechanism instead of being emailed.
  return NextResponse.json({ seekerPin: inserted, manageToken }, { status: 201 });
}
