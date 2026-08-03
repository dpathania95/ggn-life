import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportLimiter, getClientIp } from '@/lib/ratelimit';

// POST /api/rent-pins/[id]/report — community reporting, 3-report
// auto-hide (spec Section 4), same pattern as the retired discovery layer.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = getClientIp(req.headers);
  const { success } = await reportLimiter.limit(ip);

  if (!success) {
    return NextResponse.json({ error: 'Too many reports, slow down' }, { status: 429 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('increment_rent_pin_reports', { pin_id: id });

  if (error || !data) {
    console.error('Failed to report rent_pin:', JSON.stringify(error));
    return NextResponse.json({ error: 'Failed to report rent pin' }, { status: 500 });
  }

  return NextResponse.json({ rentPin: data });
}
