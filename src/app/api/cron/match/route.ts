import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  MATCH_RADIUS_METERS,
  MAX_MATCHES_PER_SEEKER_PER_RUN,
  isHardMatchForListing,
  isHardMatchForSeeker,
  seekerPreferenceScore,
} from '@/lib/matching';
import { Listing, SeekerPin } from '@/types/rental';

// GET /api/cron/match — daily matching job (spec Section 3.3/3.4/7).
// Triggered by Vercel Cron (see vercel.json); protected by CRON_SECRET so
// it can't be triggered by an arbitrary public request.
//
// For each active, unexpired seeker pin: full_flat seekers are matched
// against whole_flat listings (budget+BHK hard filter), flatmate seekers
// against other flatmate seekers (budget-only hard filter, lifestyle
// soft-rank) — the two types never cross-match (spec Section 3.3/3.4/7),
// so only the relevant RPC is queried per seeker. Match rows are created
// for genuinely new pairs (deduped against existing matches) — a
// seeker/listing can produce multiple matches over its lifetime, not
// one-and-done (spec Section 7).
//
// Email notification is not sent — Resend integration is deferred (spec
// Section 9). Match rows are created with notified=false (the column
// default) so a future notifier can find and process them.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Expire seeker pins past their 30-day window before matching (spec
  // Section 7: "skips seeker pins past their 30-day expiry").
  const { error: expireError } = await supabase
    .from('seeker_pins')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());

  if (expireError) {
    console.error('Failed to expire seeker_pins:', JSON.stringify(expireError));
  }

  const { data: activeSeekers, error: seekersError } = await supabase
    .from('seeker_pins')
    .select('*')
    .eq('status', 'active');

  if (seekersError || !activeSeekers) {
    console.error('Failed to load active seeker_pins:', JSON.stringify(seekersError));
    return NextResponse.json({ error: 'Failed to load seeker pins' }, { status: 500 });
  }

  let matchesCreated = 0;

  for (const seeker of activeSeekers as SeekerPin[]) {
    const isFullFlat = seeker.seeker_type === 'full_flat';
    let listingCandidates: Listing[] = [];
    let seekerCandidates: SeekerPin[] = [];

    // Only the relevant RPC is queried per seeker type — full_flat seekers
    // never match other seekers, flatmate seekers never match listings
    // (spec Section 3.3/3.4/7), so the other query would be entirely
    // discarded by isHardMatchForListing/isHardMatchForSeeker's own type
    // guards anyway. Skipping it avoids the wasted round-trip.
    if (isFullFlat) {
      const { data: nearbyListings, error: nearbyListingsError } = await supabase.rpc(
        'nearby_listings_for_seeker',
        { seeker_id: seeker.id, radius_meters: MATCH_RADIUS_METERS }
      );
      if (nearbyListingsError) {
        console.error('nearby_listings_for_seeker failed:', JSON.stringify(nearbyListingsError));
      }
      listingCandidates = ((nearbyListings ?? []) as Listing[]).filter((l) =>
        isHardMatchForListing(seeker, l)
      );
    } else {
      const { data: nearbySeekers, error: nearbySeekersError } = await supabase.rpc(
        'nearby_seeker_pins_for_seeker',
        { seeker_id: seeker.id, radius_meters: MATCH_RADIUS_METERS }
      );
      if (nearbySeekersError) {
        console.error('nearby_seeker_pins_for_seeker failed:', JSON.stringify(nearbySeekersError));
      }
      seekerCandidates = ((nearbySeekers ?? []) as SeekerPin[])
        .filter((other) => isHardMatchForSeeker(seeker, other))
        .sort((a, b) => seekerPreferenceScore(seeker, b) - seekerPreferenceScore(seeker, a));
    }

    let createdForThisSeeker = 0;

    for (const listing of listingCandidates) {
      if (createdForThisSeeker >= MAX_MATCHES_PER_SEEKER_PER_RUN) break;

      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('seeker_pin_id', seeker.id)
        .eq('matched_listing_id', listing.id)
        .maybeSingle();

      if (existing) continue;

      const { error: insertError } = await supabase
        .from('matches')
        .insert({ seeker_pin_id: seeker.id, matched_listing_id: listing.id });

      if (insertError) {
        console.error('Failed to insert listing match:', JSON.stringify(insertError));
        continue;
      }

      matchesCreated++;
      createdForThisSeeker++;
    }

    for (const other of seekerCandidates) {
      if (createdForThisSeeker >= MAX_MATCHES_PER_SEEKER_PER_RUN) break;

      // Pairs are symmetric — check both orderings so processing seeker B
      // later doesn't recreate the (A,B) match this seeker just made.
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .or(
          `and(seeker_pin_id.eq.${seeker.id},matched_seeker_pin_id.eq.${other.id}),` +
            `and(seeker_pin_id.eq.${other.id},matched_seeker_pin_id.eq.${seeker.id})`
        )
        .maybeSingle();

      if (existing) continue;

      const { error: insertError } = await supabase
        .from('matches')
        .insert({ seeker_pin_id: seeker.id, matched_seeker_pin_id: other.id });

      if (insertError) {
        console.error('Failed to insert seeker-to-seeker match:', JSON.stringify(insertError));
        continue;
      }

      matchesCreated++;
      createdForThisSeeker++;
    }
  }

  return NextResponse.json({ seekersProcessed: activeSeekers.length, matchesCreated });
}
