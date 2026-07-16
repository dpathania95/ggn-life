# ggn.life — Phase 1 scaffold

A crowdsourced map of cafes, parks, and hangout spots across Gurgaon. Anonymous,
no login, tap-to-pin. This is the Phase 1 discovery layer only.

Stack: **Next.js (App Router) · MapLibre GL + OpenFreeMap · Supabase (Postgres +
PostGIS + Storage) · Upstash Redis · Vercel**

## 1. Supabase setup

1. In your Supabase project, go to **SQL Editor > New query**, paste the contents
   of `supabase/schema.sql`, and run it. This creates the `pins` table, enums,
   PostGIS extension, spatial index, RLS policy, and the two RPC functions the
   API routes call (`pins_in_bounds`, `increment_pin_column`).
2. Go to **Project Settings > API** and grab:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-only)

## 2. Upstash Redis setup

1. Create a free Redis database at [upstash.com](https://upstash.com) (choose a
   region close to your Vercel deployment region).
2. From the database dashboard, copy the REST URL and REST token into
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

## 3. Local development

```bash
cp .env.example .env.local
# fill in the values from steps 1 and 2, plus a random string for IP_HASH_SALT

npm install
npm run dev
```

Open http://localhost:3000 — tap the map to drop a pin.

## 4. Deploy to Vercel

Since Vercel's already set up on your end: import this repo, add the same env
vars from `.env.local` into the project's Environment Variables settings, and
deploy. No other config needed — API routes run as serverless functions
automatically.

## What's implemented

- Full Gurgaon map (MapLibre + OpenFreeMap, no API key, no per-load billing)
- Tap-to-drop pin flow: category, name, one-liner, tags
- Category filter bar
- Pin detail panel: upvote/downvote (pin + photo separately), share, report
- Live stats bar (total pins pinned)
- IP-based rate limiting on pin creation (10/day) and voting (60/hour) —
  placeholder thresholds, tune once you have real usage data
- Server-side validation on every write path (bounds-checked to Gurgaon,
  length limits matching the spec, enum validation)
- Auto-hide: pin hidden at 3 reports, photo hidden at net -3 votes
  (photo moderation mechanics are still marked "on hold" in the product spec —
  this is a placeholder implementation, revisit before relying on it)

## What's NOT implemented yet (intentionally out of scope for this pass)

- Photo upload UI (the data model and `photo_url` field exist; wiring up
  Supabase Storage for the actual upload button is the next piece)
- Comments (cut from Phase 1 per the spec)
- "Near me" GPS-centered view (GeolocateControl is on the map already, but
  the app doesn't yet auto-recenter on load)
- Any accounts/auth — everything is intentionally anonymous per the spec

## Notes on decisions baked into the code

- **Rate limit numbers (10 pins/day, 60 votes/hour, report-hide at 3, photo-hide
  at net -3) are placeholders**, not tuned values — the spec flagged these as
  open questions. Easy to adjust in `src/lib/ratelimit.ts` and
  `src/app/api/pins/[id]/vote/route.ts`.
- **IPs are hashed before storage** (`src/lib/ratelimit.ts`, `hashIp`) — raw IPs
  are never written to the database, only used transiently for rate limiting.
- **All writes go through API routes using the Supabase service role key** —
  the browser client only ever reads. This keeps validation and rate limiting
  server-side and unbypassable from the client.
