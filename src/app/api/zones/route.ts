import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/zones — the fixed zone lookup table (spec Section 6), used by
// forms that need a zone picker (e.g. seeker pin's preferred_zone_ids).
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('zones').select('id, name').order('name');

  if (error) {
    console.error('Failed to load zones:', JSON.stringify(error));
    return NextResponse.json({ error: 'Failed to load zones' }, { status: 500 });
  }

  return NextResponse.json({ zones: data });
}
