import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service-role client — bypasses RLS entirely. Server-only: SUPABASE_SERVICE_ROLE_KEY
// must never be exposed to the browser (no NEXT_PUBLIC_ prefix) and this file must
// never be imported from a Client Component. Used by API routes for writes and for
// reads against tables with no public SELECT policy (listings, seeker_pins, matches),
// which must explicitly whitelist columns — never `select('*')` — since RLS provides
// no column-level protection once bypassed.
export const createAdminClient = () => createSupabaseClient(supabaseUrl!, serviceRoleKey!);
