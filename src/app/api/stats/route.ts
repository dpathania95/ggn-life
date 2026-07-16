import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET() {
  const supabase = supabaseServer();
  const { count, error } = await supabase
    .from('pins')
    .select('*', { count: 'exact', head: true })
    .eq('hidden', false);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }

  return NextResponse.json({ totalPins: count ?? 0 });
}
