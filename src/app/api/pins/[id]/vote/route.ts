import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { voteLimiter, getClientIp } from '@/lib/ratelimit';

type VoteTarget = 'pin' | 'photo';
type VoteDirection = 'up' | 'down';

// Threshold placeholder — see spec Section 6, photo moderation is still on hold
// so this only auto-hides the photo, never the whole pin.
const PHOTO_HIDE_THRESHOLD = -3;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = getClientIp(req.headers);
  const { success } = await voteLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many votes, slow down' }, { status: 429 });
  }

  let body: { target: VoteTarget; direction: VoteDirection };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!['pin', 'photo'].includes(body.target) || !['up', 'down'].includes(body.direction)) {
    return NextResponse.json({ error: 'Invalid target/direction' }, { status: 400 });
  }

  const supabase = supabaseServer();
  const column =
    body.target === 'pin'
      ? body.direction === 'up'
        ? 'upvotes'
        : 'downvotes'
      : body.direction === 'up'
        ? 'photo_upvotes'
        : 'photo_downvotes';

  const { data: current, error: fetchError } = await supabase
    .from('pins')
    .select('photo_upvotes, photo_downvotes')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
  }

  const { data, error } = await supabase.rpc('increment_pin_column', {
    pin_id: id,
    column_name: column,
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to register vote' }, { status: 500 });
  }

  // Photo auto-hide check (vote-based moderation placeholder — Section 6)
  if (body.target === 'photo') {
    const netPhotoVotes =
      body.direction === 'down'
        ? current.photo_upvotes - (current.photo_downvotes + 1)
        : current.photo_upvotes + 1 - current.photo_downvotes;

    if (netPhotoVotes <= PHOTO_HIDE_THRESHOLD) {
      await supabase.from('pins').update({ photo_hidden: true }).eq('id', id);
    }
  }

  return NextResponse.json({ pin: data });
}
