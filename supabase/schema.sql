-- ggn.life — Phase 1 schema
-- Run this in the Supabase SQL editor (Database > SQL Editor > New query)

-- 1. Enable PostGIS for geospatial queries
create extension if not exists postgis;

-- 2. Fixed enums matching the locked product spec
create type pin_category as enum ('cafe', 'park', 'hangout', 'hidden_gem', 'food');

create type pin_tag as enum (
  'good_for_work',
  'cheap',
  'rooftop_outdoor',
  'metro_accessible',
  'pet_friendly',
  'late_night',
  'aesthetic'
);

-- 3. Pins table
create table pins (
  id uuid primary key default gen_random_uuid(),
  category pin_category not null,
  name text not null check (char_length(name) between 1 and 80),
  one_liner text not null check (char_length(one_liner) between 1 and 100),
  tags pin_tag[] not null default '{}',
  photo_url text,
  photo_hidden boolean not null default false,

  -- geospatial: PostGIS point (lng, lat order) + plain lat/lng for easy reads
  location geography(Point, 4326) not null,
  lat double precision not null,
  lng double precision not null,

  -- voting
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  photo_upvotes integer not null default 0,
  photo_downvotes integer not null default 0,

  -- moderation
  reports integer not null default 0,
  hidden boolean not null default false,

  -- abuse prevention (never exposed to clients)
  ip_hash text not null,

  created_at timestamptz not null default now()
);

-- Spatial index — powers "pins in this bounding box / near me" queries
create index pins_location_idx on pins using gist (location);
create index pins_category_idx on pins (category);
create index pins_created_at_idx on pins (created_at desc);

-- 4. Row Level Security
alter table pins enable row level security;

-- Anyone can read pins that aren't hidden
create policy "Public can read visible pins"
  on pins for select
  using (hidden = false);

-- All writes (insert/vote/report) go through API routes using the
-- service role key, which bypasses RLS. No direct client-side writes.
-- This keeps rate limiting, validation, and ip_hash logic server-side only.

-- 5. RPC for bounding-box queries (used by the map to load pins in view)
create or replace function pins_in_bounds(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns setof pins
language sql
stable
as $$
  select *
  from pins
  where hidden = false
    and location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  order by created_at desc
  limit 500;
$$;

-- 6. Helper trigger: keep `location` in sync if lat/lng are updated directly
create or replace function sync_pin_location()
returns trigger
language plpgsql
as $$
begin
  new.location := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  return new;
end;
$$;

create trigger pins_sync_location
  before insert or update of lat, lng on pins
  for each row
  execute function sync_pin_location();

-- 7. Atomic column increment — used by /api/pins/[id]/vote and /report
-- so concurrent votes don't clobber each other (avoids read-then-write races).
create or replace function increment_pin_column(pin_id uuid, column_name text)
returns pins
language plpgsql
as $$
declare
  result pins;
begin
  if column_name not in ('upvotes', 'downvotes', 'photo_upvotes', 'photo_downvotes', 'reports') then
    raise exception 'Invalid column: %', column_name;
  end if;

  execute format('update pins set %I = %I + 1 where id = $1 returning *', column_name, column_name)
    into result
    using pin_id;

  -- Auto-hide the pin itself once it crosses the report threshold (spec Section 6)
  if column_name = 'reports' and result.reports >= 3 then
    update pins set hidden = true where id = pin_id;
    select * into result from pins where id = pin_id;
  end if;

  return result;
end;
$$;
