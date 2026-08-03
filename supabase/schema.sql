-- ggn.life — schema
-- Run this in the Supabase SQL editor (Database > SQL Editor > New query)
--
-- Discovery layer (Phase 1: cafes/parks/hangouts) has been retired in favor
-- of the rental layer (ggn-life-rental-spec.md) — the drops below clear its
-- live objects out. `sync_pin_location()` survives as a shared helper since
-- the rental tables below reuse it unmodified.

-- 1. Enable PostGIS for geospatial queries
create extension if not exists postgis;

-- 2. Drop discovery-layer objects (Phase 1 — retired)
drop function if exists increment_pin_column(uuid, text);
drop function if exists pins_in_bounds(double precision, double precision, double precision, double precision);
drop table if exists pins cascade;
drop table if exists categories cascade;
drop type if exists pin_category cascade;
drop type if exists pin_tag cascade;

-- 3. Shared helper: keep a `location` geography column in sync with
-- plain lat/lng columns on insert/update. Generic over any table with
-- lat/lng/location columns of these names — reused by every rental table.
create or replace function sync_pin_location()
returns trigger
language plpgsql
as $$
begin
  new.location := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  return new;
end;
$$;

-- =========================================================================
-- Part 2: Rental layer (ggn-life-rental-spec.md)
-- =========================================================================

-- 1. Zones — lookup table, not a fixed enum, so zones can be added/adjusted
-- without a schema migration (spec Section 6).
create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  center_lat double precision not null,
  center_lng double precision not null
);

alter table zones enable row level security;

create policy "Public can read zones"
  on zones for select
  using (true);

-- Seed: 18 launch zones (spec Section 6). Centroids are approximate
-- locality-level estimates, not surveyed boundaries — refine later if
-- nearest-centroid assignment proves inaccurate in practice.
insert into zones (name, center_lat, center_lng) values
  ('Cyber City', 28.4950, 77.0890),
  ('DLF Phase 1', 28.4780, 77.0970),
  ('DLF Phase 2', 28.4830, 77.0870),
  ('DLF Phase 3', 28.4910, 77.0930),
  ('DLF Phase 4', 28.4680, 77.0930),
  ('DLF Phase 5', 28.4520, 77.1010),
  ('Golf Course Road', 28.4400, 77.1010),
  ('Golf Course Extension Road', 28.4080, 77.0730),
  ('Sushant Lok (1/2/3)', 28.4610, 77.0720),
  ('South City (1 & 2)', 28.4460, 77.0530),
  ('MG Road / Sikanderpur', 28.4790, 77.0810),
  ('Sohna Road', 28.4020, 77.0330),
  ('Palam Vihar', 28.5100, 77.0330),
  ('Old Gurgaon (Sector 4-17 belt, Civil Lines area)', 28.4640, 77.0270),
  ('New Gurgaon (Sector 82-95 belt)', 28.3900, 76.9800),
  ('Dwarka Expressway', 28.5060, 77.0450),
  ('Sector 56-57 / Nirvana Country belt', 28.4180, 77.1080),
  ('Udyog Vihar', 28.5010, 77.0870);

-- 2. Enums for the rental layer
create type rent_bhk as enum ('1', '2', '3', '4_plus');
create type furnishing_type as enum ('unfurnished', 'semi', 'fully');
create type listing_type as enum ('whole_flat', 'room_flatmate');
create type listing_status as enum ('active', 'rented');
create type seeker_status as enum ('active', 'matched', 'expired');
create type gender_pref_type as enum ('male', 'female');
create type smoking_pref_type as enum ('smoker', 'non_smoker');
create type food_pref_type as enum ('veg', 'non_veg');

-- 3. Zone assignment — nearest-centroid (spec Section 6). Defined before the
-- tables below since their triggers reference these functions.
create or replace function nearest_zone_id(p_lat double precision, p_lng double precision)
returns uuid
language sql
stable
as $$
  select id
  from zones
  order by
    ST_MakePoint(center_lng, center_lat)::geography
      <-> ST_MakePoint(p_lng, p_lat)::geography
  limit 1;
$$;

create or replace function assign_nearest_zone()
returns trigger
language plpgsql
as $$
begin
  new.zone_id := nearest_zone_id(new.lat, new.lng);
  return new;
end;
$$;

-- 4. RentPin — anonymous rent transparency (spec Section 3.1)
create table rent_pins (
  id uuid primary key default gen_random_uuid(),
  rent integer not null check (rent > 0),
  bhk rent_bhk not null,
  furnishing furnishing_type not null,
  gated boolean not null,
  floor integer,
  description text check (char_length(description) <= 500),
  need_parking boolean not null,

  -- geospatial: coordinates rounded to ~100m by the API before insert
  -- (spec Section 3.1) — schema stores whatever it's given.
  location geography(Point, 4326) not null,
  lat double precision not null,
  lng double precision not null,
  zone_id uuid references zones (id),

  -- moderation (same pattern as discovery-layer `pins`)
  reports integer not null default 0,
  hidden boolean not null default false,
  is_outlier boolean not null default false,

  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index rent_pins_location_idx on rent_pins using gist (location);
create index rent_pins_zone_idx on rent_pins (zone_id);
create index rent_pins_bhk_idx on rent_pins (bhk);
create index rent_pins_created_at_idx on rent_pins (created_at desc);

alter table rent_pins enable row level security;

create policy "Public can read visible rent pins"
  on rent_pins for select
  using (hidden = false);

create trigger rent_pins_sync_location
  before insert or update of lat, lng on rent_pins
  for each row
  execute function sync_pin_location();

create trigger rent_pins_assign_zone
  before insert on rent_pins
  for each row
  execute function assign_nearest_zone();

-- RPC for bounding-box queries (used by the map to load rent pins in view)
create or replace function rent_pins_in_bounds(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns setof rent_pins
language sql
stable
as $$
  select *
  from rent_pins
  where hidden = false
    and location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  order by created_at desc
  limit 500;
$$;

-- Atomic report increment — auto-hides at 3 reports (spec Section 4), same
-- pattern as the discovery layer's retired increment_pin_column. Atomic so
-- concurrent reports don't clobber each other (avoids read-then-write races).
create or replace function increment_rent_pin_reports(pin_id uuid)
returns rent_pins
language plpgsql
as $$
declare
  result rent_pins;
begin
  update rent_pins set reports = reports + 1 where id = pin_id returning * into result;

  if result.reports >= 3 then
    update rent_pins set hidden = true where id = pin_id returning * into result;
  end if;

  return result;
end;
$$;

-- 5. Listing — zero-brokerage flat/room listings (spec Section 3.2)
create table listings (
  id uuid primary key default gen_random_uuid(),
  type listing_type not null,
  rent integer not null check (rent > 0),
  deposit integer not null check (deposit >= 0),
  bhk rent_bhk not null,
  furnishing furnishing_type not null,
  parking boolean not null,
  gated boolean not null,
  available_from date not null,
  description text check (char_length(description) <= 500),

  -- exact — not rounded, unlike rent_pins (spec Section 3.2)
  location geography(Point, 4326) not null,
  lat double precision not null,
  lng double precision not null,
  zone_id uuid references zones (id),

  contact_email text not null,
  status listing_status not null default 'active',
  manage_token_hash text not null,

  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index listings_location_idx on listings using gist (location);
create index listings_zone_idx on listings (zone_id);
create index listings_status_idx on listings (status);
create index listings_bhk_idx on listings (bhk);

alter table listings enable row level security;

-- No public select policy: this table carries contact_email and
-- manage_token_hash, which must never reach an anon-key client. RLS is
-- row-level only, so the actual protection is that all reads go through
-- API routes using the service role key, which must explicitly select
-- only public-safe columns — never `select('*')` against this table.

create trigger listings_sync_location
  before insert or update of lat, lng on listings
  for each row
  execute function sync_pin_location();

create trigger listings_assign_zone
  before insert on listings
  for each row
  execute function assign_nearest_zone();

-- RPC for bounding-box queries (used by the map to load listings in view).
-- Explicitly whitelists public-safe columns — contact_email and
-- manage_token_hash are never returned, since this table has no public
-- SELECT policy for exactly that reason.
create or replace function listings_in_bounds(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  id uuid,
  type listing_type,
  rent integer,
  deposit integer,
  bhk rent_bhk,
  furnishing furnishing_type,
  parking boolean,
  gated boolean,
  available_from date,
  description text,
  lat double precision,
  lng double precision,
  zone_id uuid,
  status listing_status,
  created_at timestamptz
)
language sql
stable
as $$
  select
    l.id, l.type, l.rent, l.deposit, l.bhk, l.furnishing, l.parking, l.gated,
    l.available_from, l.description, l.lat, l.lng, l.zone_id, l.status, l.created_at
  from listings l
  where l.status = 'active'
    and l.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  order by l.created_at desc
  limit 500;
$$;

-- 6. SeekerPin — want-ads for daily matching (spec Section 3.3/3.4)
create table seeker_pins (
  id uuid primary key default gen_random_uuid(),
  budget_min integer not null check (budget_min > 0),
  budget_max integer not null check (budget_max >= budget_min),
  bhk rent_bhk not null,
  preferred_zone_ids uuid[] not null default '{}',
  move_in_by date not null,
  gender_pref gender_pref_type,
  smoking_pref smoking_pref_type,
  food_pref food_pref_type,
  pet_owner boolean not null default false,

  -- anchor point for radius matching — can be rounded, per spec Section 6
  location geography(Point, 4326) not null,
  lat double precision not null,
  lng double precision not null,
  zone_id uuid references zones (id),

  contact_email text not null,
  status seeker_status not null default 'active',
  manage_token_hash text not null,
  expires_at timestamptz not null default (now() + interval '30 days'),

  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index seeker_pins_location_idx on seeker_pins using gist (location);
create index seeker_pins_zone_idx on seeker_pins (zone_id);
create index seeker_pins_status_idx on seeker_pins (status);
create index seeker_pins_expires_at_idx on seeker_pins (expires_at);

alter table seeker_pins enable row level security;

-- Same reasoning as listings — carries contact_email + manage_token_hash,
-- no public select policy.

create trigger seeker_pins_sync_location
  before insert or update of lat, lng on seeker_pins
  for each row
  execute function sync_pin_location();

create trigger seeker_pins_assign_zone
  before insert on seeker_pins
  for each row
  execute function assign_nearest_zone();

-- RPC for bounding-box queries (used by the map to load seeker pins in
-- view, spec Section 3.9's layer toggle). Explicitly whitelists public-safe
-- columns — contact_email and manage_token_hash are never returned, since
-- this table has no public SELECT policy for exactly that reason.
create or replace function seeker_pins_in_bounds(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  id uuid,
  budget_min integer,
  budget_max integer,
  bhk rent_bhk,
  preferred_zone_ids uuid[],
  move_in_by date,
  gender_pref gender_pref_type,
  smoking_pref smoking_pref_type,
  food_pref food_pref_type,
  pet_owner boolean,
  lat double precision,
  lng double precision,
  zone_id uuid,
  status seeker_status,
  created_at timestamptz
)
language sql
stable
as $$
  select
    s.id, s.budget_min, s.budget_max, s.bhk, s.preferred_zone_ids, s.move_in_by,
    s.gender_pref, s.smoking_pref, s.food_pref, s.pet_owner, s.lat, s.lng,
    s.zone_id, s.status, s.created_at
  from seeker_pins s
  where s.status = 'active'
    and s.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  order by s.created_at desc
  limit 500;
$$;

-- RPCs for the daily matching job (spec Section 3.3/3.4/7). Unlike the
-- *_in_bounds RPCs above, these return FULL rows (including contact_email)
-- since they're only ever called server-side, by the cron job, via the
-- service-role client — never exposed as a public API response.
create or replace function nearby_listings_for_seeker(seeker_id uuid, radius_meters double precision)
returns setof listings
language sql
stable
as $$
  select l.*
  from listings l
  join seeker_pins s on s.id = seeker_id
  where l.status = 'active'
    and ST_DWithin(l.location, s.location, radius_meters)
  order by l.location <-> s.location;
$$;

create or replace function nearby_seeker_pins_for_seeker(seeker_id uuid, radius_meters double precision)
returns setof seeker_pins
language sql
stable
as $$
  select sp.*
  from seeker_pins sp
  join seeker_pins s on s.id = seeker_id
  where sp.id <> seeker_id
    and sp.status = 'active'
    and sp.expires_at > now()
    and ST_DWithin(sp.location, s.location, radius_meters)
  order by sp.location <-> s.location;
$$;

-- 7. Match — records a seeker<->listing or seeker<->seeker pairing (spec Section 7)
create table matches (
  id uuid primary key default gen_random_uuid(),
  seeker_pin_id uuid not null references seeker_pins (id),
  matched_listing_id uuid references listings (id),
  matched_seeker_pin_id uuid references seeker_pins (id),
  matched_at timestamptz not null default now(),
  notified boolean not null default false,

  -- a match is either seeker<->listing or seeker<->seeker, never both/neither
  check (
    (matched_listing_id is not null and matched_seeker_pin_id is null)
    or (matched_listing_id is null and matched_seeker_pin_id is not null)
  )
);

create index matches_seeker_pin_idx on matches (seeker_pin_id);
create index matches_listing_idx on matches (matched_listing_id);

alter table matches enable row level security;

-- No public select policy — internal bookkeeping only, written/read by the
-- daily matching job via the service role key.
