import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listingCreateLimiter, hashIp, getClientIp } from '@/lib/ratelimit';
import { generateManageToken } from '@/lib/manageToken';
import { isInGurgaonBounds, RENT_PLAUSIBILITY_RANGE } from '@/lib/rentalConstants';
import {
  FURNISHING_VALUES,
  LISTING_TYPE_VALUES,
  NewListingInput,
  RENT_BHK_VALUES,
} from '@/types/rental';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/listings?minLng=&minLat=&maxLng=&maxLat=
// Loads active listings within the current map viewport via the
// listings_in_bounds RPC, which excludes contact_email/manage_token_hash —
// this table has no public SELECT policy, so only explicitly whitelisted
// columns ever leave the server (see schema.sql Part 2 comments).
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
  const { data, error } = await supabase.rpc('listings_in_bounds', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
  });

  if (error) {
    console.error('Failed to load listings:', JSON.stringify(error));
    return NextResponse.json({ error: 'Failed to load listings' }, { status: 500 });
  }

  return NextResponse.json({ listings: data });
}

// POST /api/listings — create a listing. Requires an email (used only for
// match notifications and the manage link, never shown publicly), rate
// limited to 1 per IP per day (spec Section 3.2/4).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success } = await listingCreateLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Daily listing limit reached. Try again tomorrow.' },
      { status: 429 }
    );
  }

  let body: NewListingInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    type,
    rent,
    deposit,
    bhk,
    furnishing,
    parking,
    gated,
    available_from,
    description,
    contact_email,
    lat,
    lng,
  } = body;

  // Server-side validation — never trust the client, especially with no auth layer.
  if (!LISTING_TYPE_VALUES.includes(type)) {
    return NextResponse.json({ error: 'Invalid listing type' }, { status: 400 });
  }
  if (!RENT_BHK_VALUES.includes(bhk)) {
    return NextResponse.json({ error: 'Invalid bhk' }, { status: 400 });
  }
  if (!FURNISHING_VALUES.includes(furnishing)) {
    return NextResponse.json({ error: 'Invalid furnishing' }, { status: 400 });
  }
  if (typeof rent !== 'number' || !Number.isFinite(rent) || rent <= 0) {
    return NextResponse.json({ error: 'rent must be a positive number' }, { status: 400 });
  }
  const [minRent, maxRent] = RENT_PLAUSIBILITY_RANGE[bhk];
  if (rent < minRent || rent > maxRent) {
    return NextResponse.json(
      { error: `rent must be between ${minRent} and ${maxRent} for ${bhk} BHK` },
      { status: 400 }
    );
  }
  if (typeof deposit !== 'number' || !Number.isFinite(deposit) || deposit < 0) {
    return NextResponse.json({ error: 'deposit must be a non-negative number' }, { status: 400 });
  }
  if (typeof parking !== 'boolean') {
    return NextResponse.json({ error: 'parking must be a boolean' }, { status: 400 });
  }
  if (typeof gated !== 'boolean') {
    return NextResponse.json({ error: 'gated must be a boolean' }, { status: 400 });
  }
  const availableFromDate = new Date(available_from);
  if (!available_from || Number.isNaN(availableFromDate.getTime())) {
    return NextResponse.json({ error: 'available_from must be a valid date' }, { status: 400 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (availableFromDate < today) {
    return NextResponse.json({ error: 'available_from cannot be in the past' }, { status: 400 });
  }
  if (description != null && description.length > 500) {
    return NextResponse.json(
      { error: 'description must be at most 500 characters' },
      { status: 400 }
    );
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

  const { token: manageToken, tokenHash } = generateManageToken();

  const supabase = createAdminClient();
  const { data: inserted, error: insertError } = await supabase
    .from('listings')
    .insert({
      type,
      rent,
      deposit,
      bhk,
      furnishing,
      parking,
      gated,
      available_from,
      description: description?.trim() || null,
      contact_email: contact_email.trim(),
      manage_token_hash: tokenHash,
      // Exact location, not rounded — unlike rent pins (spec Section 3.2).
      lat,
      lng,
      ip_hash: hashIp(ip),
    })
    .select('id, type, rent, deposit, bhk, furnishing, parking, gated, available_from, description, lat, lng, zone_id, status, created_at')
    .single();

  if (insertError || !inserted) {
    console.error('Failed to insert listing:', JSON.stringify(insertError));
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
  }

  // manageToken is the raw, one-time value — only its hash is stored. Until
  // email integration exists (spec Section 3.6), it's returned directly here
  // as a stand-in delivery mechanism instead of being emailed.
  return NextResponse.json({ listing: inserted, manageToken }, { status: 201 });
}
