import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { voteLimiter, getClientIp } from '@/lib/ratelimit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = getClientIp(req.headers);
  const { success } = await voteLimiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many reports, slow down' }, { status: 429 });
  }

  const supabase = supabaseServer();
  // 3+ reports auto-hides the pin — see spec Section 6.
  const { data, error } = await supabase.rpc('increment_pin_column', {
    pin_id: id,
    column_name: 'reports',
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to report pin' }, { status: 500 });
  }

  return NextResponse.json({ pin: data });
}
