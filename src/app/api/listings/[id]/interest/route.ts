import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { interestRequestLimiter, hashIp, getClientIp } from '@/lib/ratelimit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/listings/[id]/interest — instant, on-demand contact request
// (spec Section 3.10). No budget/BHK gate — the person browsing already
// made a deliberate choice by clicking through. Rate limited separately
// from pin creation (5/day/IP, spec Section 4). No email is sent — Resend
// integration is deferred (spec Section 9); the request is only persisted.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = getClientIp(req.headers);
  const { success } = await interestRequestLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many interest requests today. Try again tomorrow.' },
      { status: 429 }
    );
  }

  let body: { from_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { from_email } = body;
  if (typeof from_email !== 'string' || !EMAIL_PATTERN.test(from_email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (listingError) {
    console.error('Failed to load listing for interest request:', JSON.stringify(listingError));
    return NextResponse.json({ error: 'Failed to record interest' }, { status: 500 });
  }
  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }
  if (listing.status !== 'active') {
    return NextResponse.json({ error: 'This listing is no longer active' }, { status: 400 });
  }

  const { error: insertError } = await supabase.from('interest_requests').insert({
    target_type: 'listing',
    target_listing_id: id,
    from_email: from_email.trim(),
    ip_hash: hashIp(ip),
  });

  if (insertError) {
    console.error('Failed to insert interest_request:', JSON.stringify(insertError));
    return NextResponse.json({ error: 'Failed to record interest' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
