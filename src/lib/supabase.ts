import { createClient } from '@supabase/supabase-js';

// Browser client — safe to use in client components.
// Only ever reads data (RLS restricts it to non-hidden pins, no write access).
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server client — service role key, used ONLY inside API routes (never imported
// into client components). Bypasses RLS, so every write path using this client
// must validate/sanitize input itself before touching the database.
export function supabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
