import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RENT_BHK_VALUES, RentBhk } from '@/types/rental';

// GET /api/area-stats?zoneId=<uuid>
// Average rent by BHK for a zone, computed from anonymous rent pin data
// (spec Section 3.5). Deliberately simple — average + pin count, not a
// full dashboard. Aggregated here in JS rather than SQL since expected
// data volumes are small at launch (matches the rest of the codebase's
// "keep simple for launch" pattern).
export async function GET(req: NextRequest) {
  const zoneId = req.nextUrl.searchParams.get('zoneId');
  if (!zoneId) {
    return NextResponse.json({ error: 'zoneId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: zone, error: zoneError } = await supabase
    .from('zones')
    .select('id, name')
    .eq('id', zoneId)
    .single();

  if (zoneError || !zone) {
    return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
  }

  const { data: pins, error: pinsError } = await supabase
    .from('rent_pins')
    .select('bhk, rent')
    .eq('zone_id', zoneId)
    .eq('hidden', false);

  if (pinsError) {
    console.error('Failed to load rent_pins for area stats:', JSON.stringify(pinsError));
    return NextResponse.json({ error: 'Failed to compute area stats' }, { status: 500 });
  }

  const rows = pins ?? [];
  const byBhk = RENT_BHK_VALUES.map((bhk) => {
    const matching = rows.filter((p) => p.bhk === bhk);
    if (matching.length === 0) return null;
    const avgRent = Math.round(matching.reduce((sum, p) => sum + p.rent, 0) / matching.length);
    return { bhk, avgRent, count: matching.length };
  }).filter((b): b is { bhk: RentBhk; avgRent: number; count: number } => b !== null);

  return NextResponse.json({ zone, totalPins: rows.length, byBhk });
}
