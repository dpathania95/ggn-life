# Product Spec — ggn.life Rental Layer

**Owner:** [You]
**Status:** Draft v1
**Scope:** Full rental feature set — rent pins (transparency), zero-brokerage listings, and seeker/flatmate matching. This is the active build focus; the discovery layer (cafes/parks/hangouts) is spec'd and scaffolded separately and is paused, not abandoned.

---

## 1. Goal

Give Gurgaon renters two things brokers currently gatekeep:
1. **What rent people actually pay** — not what's quoted
2. **A way to find or list flats and flatmates without paying brokerage**

Builds on the same map used for the discovery layer — this is an additive layer, not a separate app.

**Not the goal yet:** monetization, payments/rent collection, lease/legal document handling, verified-owner badges, in-app messaging.

---

## 2. Target user

- **Renters/seekers** — actively looking for a flat or a flatmate, frustrated by broker markups and gatekept "society entry"
- **Owners/listers** — want to rent out a flat or a spare room without paying a broker's cut
- Both groups overlap with the existing discovery-layer audience (young professional / corporate crowd), so that audience is a natural funnel into this layer

---

## 3. Core features

### 3.1 Anonymous rent pinning (transparency layer)
- Tap the map → drop a rent pin
- Fields: monthly rent (₹), BHK (1/2/3/4+), furnishing (unfurnished/semi/fully), gated society (yes/no), floor (optional), parking availability (yes/no), optional free-text description
- **Fully anonymous — no login, no email**, same frictionless flow as the discovery layer
- Rendered as a separate map layer/toggle from discovery pins — different icon style, since rent pins are data points, not "places"
- Coordinates rounded (~100m) before storage — unlike discovery pins, this reveals something close to someone's home address

### 3.2 Direct flat listings (zero brokerage)
- Owner posts a listing: whole flat or room-for-flatmate
- Fields: rent, deposit, availability date, BHK, furnishing, parking (yes/no), gated society, free-text description
- **Requires an email address** to post — used only for match notifications, never shown publicly
- Contact info is never displayed on the map or listing card — only released once a match is made (see 3.3)
- Status: active / rented *(no auto-expiry for now — see Section 8)*

### 3.3 Seeker pins + matching
- **First step: "What are you looking for?"** — branches into two distinct forms, **Full flat** or **Flatmate** (see Section 3.7 for the full entry flow). This replaced a single shared form, since a flatmate search needs personal/lifestyle fields that are irrelevant to someone renting a whole flat, and vice versa
- **Common to both forms**: budget range, preferred zone(s), move-in timeframe, tapped location (anchor point for radius matching), contact email
- **Full flat-specific fields**: BHK (required), furnishing preference, parking need, gated society preference
- **Flatmate-specific fields**: gender preference, smoking preference, food preference, pet-owner (yes/no); BHK is not collected here — a flatmate seeker is either joining a room within someone else's existing flat (handled via 3.10's "interested" flow on a `room_flatmate` listing, not a seeker pin at all) or teaming up with another from-scratch seeker to decide on a flat jointly (Section 3.4) — either way, BHK isn't the seeker's decision to make alone at this stage
- Requires email either way (matching can't work anonymously past this point)
- **Expires 30 days after posting** — auto-marked expired and excluded from matching once past this window; keeps seeker data fresh since move-in timelines are short-lived by nature
- **Shares the same tap-to-drop entry point as rent pins and listings** — the tapped location becomes the seeker pin's anchor point, while preferred area(s) is a separate field within the form itself
- **Daily matching job**: full-flat seeker pins match against `whole_flat` listings; flatmate seeker pins match against other flatmate seeker pins (see 3.4) — the two types don't cross-match each other
- **Matching logic: hard filter on budget and BHK (full-flat type) / budget only (flatmate type, since BHK isn't collected), soft ranking on lifestyle preferences.** A match must clear the hard filter to exist at all; preference overlap only affects ranking among valid matches, never excludes one
- On match: both sides get an email with each other's contact info — the only point contact info ever surfaces via the automated path (see also 3.10 for the instant, on-demand path)
- No in-app messaging for launch — email handoff is enough to start

### 3.4 Flatmate matching (seeker-to-seeker)
- Same daily job as 3.3, matching **flatmate-type** seeker pins to *each other* — lets two strangers pair up and rent a flat together that neither could find alone, jointly deciding on BHK/location once matched rather than one side dictating it upfront
- Same hard-filter/soft-rank logic (budget + preference overlap), same email handoff

### 3.5 Area rent stats
- Tap/select an area → average rent by BHK for that pocket, computed from anonymous rent pin data (3.1)
- The single most shareable feature in this layer — a screenshot-and-send-to-WhatsApp stat, same mechanic that made rent pins work for bengaluru.rent
- Keep simple for launch: average + pin count for that area, not a full dashboard

### 3.6 Managing your listing/seeker pin (magic-link, no login)
- The product has no accounts, so status updates (mark a listing "rented," mark a seeker pin "matched," or delete either) can't go through a dashboard/login — they go through a **private magic link** instead
- On creation, a random token is generated; a **hashed** version is stored in the DB (`manage_token_hash`), the raw token is never persisted — it only ever exists in the email sent to the owner/seeker
- That email is sent immediately on creation (not just at match time), with a "manage this listing" / "manage this search" link
- The link lands on a simple no-login page: mark as rented/matched, or delete the pin — possession of the link is the only authentication, consistent with the product's anonymous-first design
- The same manage link is also included in every match notification email, since that's the moment someone is most likely to want to act on it
- **Known limitation, not fully solved by this**: nothing forces someone to use the link — an abandoned listing can sit as "active" indefinitely with no owner action. Auto-expiry was deliberately left out of scope for listings (see Section 8 discussion), so for now stale-but-still-listed flats are an accepted risk rather than a solved problem. Worth revisiting if it turns out to be a real issue post-launch.

### 3.7 Pin/listing/seeker entry flow
- **Rent pins, listings, and seeker pins all share one map entry point**: tap the map → "What are you sharing?" → three-way branch (anonymous 30-second form for rent pins, fuller email-gated form for listings, email-gated seeker flow for seeker pins)
- **Seeker pins have a second branching step**: after choosing "I'm looking for a place," a follow-up question — "Full flat, or a flatmate?" — routes to one of two distinct forms with different fields (see Section 3.3). This replaced an earlier single shared seeker form, since the two searches need meaningfully different information
- Keeps the core map interaction consistent with the discovery layer's tap-to-drop pattern, rather than introducing a second mental model
- For a seeker pin (either type), the tapped location becomes the search's anchor point (used for radius-based matching); preferred area(s) is a separate field inside the form itself, not the tap location — so tapping still makes sense even though a seeker pin represents a want-ad rather than a specific address

### 3.8 Location search bar
- A search bar on the map lets someone type a place/address/locality name and jump the map there — e.g. "DLF Phase 3" or a specific society name — rather than having to pan/zoom manually to find an area
- **Geocoding provider: Nominatim (OpenStreetMap's free public search API)** — consistent with the rest of the map stack (MapLibre + OpenFreeMap), no API key, no billing
- Known trade-off, consistent with what was flagged earlier when the map stack was chosen: Nominatim's address/typo tolerance is noticeably weaker than Google's, especially for Gurgaon's informal addressing ("near XYZ society gate 2" style). Acceptable for launch since most searches will be locality/society names, not full informal addresses — revisit with a paid geocoder only if this proves to be a real friction point
- Public Nominatim has a strict usage policy (1 request/second, requires a proper User-Agent, no heavy automated use) — the search bar's requests should go through a server-side API route that debounces input and respects this, not call Nominatim directly from the browser
- Selecting a search result recenters/zooms the map to that location; it does not filter or affect which pins are shown — that's what filters (3.9) are for

### 3.9 Filters for pinned properties
- A filter panel lets someone narrow down what's showing on the rental layer, separate from the search bar's "go to a place" purpose
- **Layer toggle**: Rent pins / Listings / Seeker pins (or any combination) — shown/hidden independently, since they're visually distinct pin types on the map
- **Seeker pins are browsable on the map, anonymized** — rendered as a budget/BHK bubble (e.g. "₹25–30k · 2BHK"), no name or contact shown. This lets an owner with a spare room, or another seeker looking for a flatmate, browse people actively searching rather than only relying on the algorithm to pair them (see 3.10)
- **Filters that apply to rent pins, listings, and seeker pins alike**: BHK (1/2/3/4+ — n/a for flatmate-type seeker pins, which don't collect BHK), budget range (min–max), zone/area (from the 18-zone taxonomy, Section 6)
- **Furnishing / gated / parking filters**: apply to rent pins, listings, and full-flat-type seeker pins (which now collect these as preferences) — not applicable to flatmate-type seeker pins
- **Listing-specific filter**: type (whole flat / room-flatmate)
- Filters combine with the map's current viewport — i.e. filtering narrows what's shown within the bounding box already being queried (see `pins_in_bounds`-style query pattern from the discovery layer), not a separate city-wide search results list
- Out of scope for launch: saved filter presets, filter-based email alerts ("notify me when a 2BHK under 25k appears") — a reasonable future add, not needed for the initial version

### 3.10 Instant "I'm interested" contact request
- Every listing and every seeker pin detail card has an **"I'm interested"** button — this is the manual, on-demand counterpart to the daily automated matching job (Section 7), not a replacement for it
- Clicking it opens a single-field modal ("Enter your email so they can reach you"), no account or existing pin required — someone can express interest in one specific listing without ever posting a seeker pin of their own
- On submit, the *other* party gets an immediate email with the interested person's contact email attached — contact exchange happens right away, not on the next matching-job run
- Unlike the matching job, this is **not filtered by budget/BHK hard rules** — the person browsing already made a deliberate, informed choice by looking at the listing/seeker pin and clicking through, so no algorithmic gate is needed
- Rate limited separately from pin creation — suggested starting point: **5 interest-requests per day per IP**, looser than the 1/day pin-creation cap since expressing interest is lower-stakes but still needs a ceiling against spam
- Enables the two ways to find a flatmate: **passive** (post a seeker pin, wait for the daily matching job) or **active** (browse other people's seeker pins directly and click interested) — same mechanic also covers an owner proactively reaching out to a seeker whose ad they liked

---

## 4. Anti-fraud / trust layer

- **Plausibility ranges per BHK** — reject rent pins/listings wildly outside a sane range for the area
- **Outlier flagging** — pins 3x+ above/below the local median get a visual "unverified/outlier" flag rather than being silently trusted
- **Community reporting** — 3-report auto-hide, same pattern as the discovery layer
- **IP rate limiting** — **1 pin per day per IP, per action type** (rent pin, listing, seeker pin each capped independently — a user can post one of each in the same day, since that's normal usage, not abuse). **Instant "I'm interested" requests (Section 3.10) get their own, looser cap — 5 per day per IP** — since expressing interest is lower-stakes than posting a pin, but still needs a ceiling
- **Coordinate rounding** (~100m) for rent pins only — not applied to listings, since a listing's whole point is to be locatable

---

## 5. Explicitly OUT of scope for this phase

- ❌ In-app messaging/chat (email handoff only)
- ❌ Payments, rent collection, deposits handled in-app
- ❌ Lease generation or legal document handling
- ❌ Verified-owner badges / ID verification
- ❌ Broker accounts of any kind — zero-brokerage is the whole premise, no broker-facing features, ever
- ❌ Push notifications (email only for match alerts)
- ❌ Photo moderation beyond what's already flagged as on-hold for the discovery layer (applies to listing photos too)

---

## 6. Data model

**Zones** (lookup table — not a fixed enum, so zones can be added/adjusted without a schema migration)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | e.g. "DLF Phase 3" |
| center_lat | float | zone centroid, used for nearest-centroid assignment |
| center_lng | float | |

**Zone assignment mechanism: nearest-centroid.** Each zone has one representative lat/lng. A new pin/listing is assigned to whichever zone's centroid is geographically closest — computed at creation time via PostGIS distance query against the `zones` table. This is a deliberate simplification, not precise polygon boundaries: Gurgaon's informal locality boundaries (DLF phases, Sushant Lok, etc.) aren't officially defined anywhere the way sector boundaries are, so there's no authoritative free source for real GIS shapes. Known limitation: pins right at the edge between two zones (e.g. the DLF Phase 2/3 border) may get bucketed to either — accepted for launch, revisit with real polygon data only if this turns out to matter in practice.

**Zone taxonomy (18 zones for launch)** — clustered at locality level, not full HUDA sector-by-sector granularity (115+ sectors would fragment rent-stats data too thin to be meaningful):

1. Cyber City
2. DLF Phase 1
3. DLF Phase 2
4. DLF Phase 3
5. DLF Phase 4
6. DLF Phase 5
7. Golf Course Road
8. Golf Course Extension Road
9. Sushant Lok (1/2/3)
10. South City (1 & 2)
11. MG Road / Sikanderpur
12. Sohna Road
13. Palam Vihar
14. Old Gurgaon (Sector 4–17 belt, Civil Lines area)
15. New Gurgaon (Sector 82–95 belt)
16. Dwarka Expressway
17. Sector 56–57 / Nirvana Country belt
18. Udyog Vihar

**RentPin**
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| rent | int | monthly, ₹ |
| bhk | enum | 1 / 2 / 3 / 4_plus |
| furnishing | enum | unfurnished / semi / fully |
| gated | bool | |
| floor | int | optional |
| description | text | optional free-form notes (e.g. "society has a park," "landlord lives on-site") |
| need_parking | bool | parking availability at this rental |
| lat/lng | float | rounded to ~100m before storage |
| zone_id | uuid | FK to `zones` table, assigned via nearest-centroid at creation |
| reports | int | default 0, auto-hide at 3 |
| is_outlier | bool | computed — 3x+ local median |
| created_at | timestamp | |
| ip_hash | string | never displayed |

**Listing**
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| type | enum | whole_flat / room_flatmate |
| rent | int | monthly, ₹ |
| deposit | int | |
| bhk | enum | |
| furnishing | enum | |
| parking | bool | |
| gated | bool | |
| available_from | date | |
| description | text | free-form |
| lat/lng | float | exact — not rounded |
| zone_id | uuid | FK to `zones` table, assigned via nearest-centroid at creation |
| contact_email | string | server-only, never exposed publicly |
| status | enum | active / rented |
| manage_token_hash | string | hashed token — raw token only ever exists in the owner's email link, never stored in plaintext (see Section 3.7) |
| created_at | timestamp | |
| ip_hash | string | |

**SeekerPin**
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| seeking_type | enum | full_flat / flatmate — set by the first branching question (Section 3.7), determines which fields below are populated |
| budget_min | int | common to both types |
| budget_max | int | common to both types |
| preferred_zone_ids | array[uuid] | common to both types, FKs to `zones` table |
| move_in_by | date | common to both types |
| bhk | enum | **full_flat only**, required for that type, null for flatmate (see Section 3.3 for why) |
| furnishing_pref | enum | **full_flat only**, nullable |
| parking_pref | bool | **full_flat only**, nullable |
| gated_pref | bool | **full_flat only**, nullable |
| gender_pref | enum | **flatmate only**, nullable |
| smoking_pref | enum | **flatmate only**, nullable |
| food_pref | enum | **flatmate only**, nullable |
| pet_owner | bool | **flatmate only**, nullable |
| contact_email | string | server-only |
| status | enum | active / matched / expired |
| manage_token_hash | string | hashed token — see Section 3.6 |
| expires_at | timestamp | auto-set on creation, +30 days |
| lat/lng | float | anchor point for radius matching, can be rounded |
| created_at | timestamp | |
| ip_hash | string | |

**Match**
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| seeker_pin_id | uuid | |
| matched_listing_id | uuid | nullable — null for seeker-to-seeker matches |
| matched_seeker_pin_id | uuid | nullable — set only for flatmate matches |
| matched_at | timestamp | |
| notified | bool | whether match emails have gone out |

**InterestRequest** (Section 3.10 — the instant, on-demand counterpart to `Match`)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| target_type | enum | listing / seeker_pin — what the interest was expressed toward |
| target_id | uuid | the listing or seeker pin id |
| from_email | string | server-only, entered at click-time, never shown publicly |
| created_at | timestamp | |
| ip_hash | string | powers the 5/day/IP rate limit (Section 4) |

---

## 7. Matching job — mechanics

- Runs daily (Vercel Cron — already in the existing stack, no new infra needed)
- Skips seeker pins past their 30-day expiry (status = expired)
- **Full-flat seeker pins** match against `whole_flat` listings within ~2.5km
- **Flatmate seeker pins** match against other flatmate seeker pins within ~2.5km (see Section 3.4) — never against listings, and never against full-flat seeker pins
- **Hard filter**: budget range must match for both types; BHK must also match for full-flat matches (flatmate matches skip this, since flatmate seeker pins don't collect BHK)
- **Soft rank**: among hard-filter-valid candidates, rank by lifestyle preference overlap (food, smoking, gender, pets) — flatmate matches only, since full-flat seeker pins don't collect these
- On a new match: create a Match record, email both parties with each other's contact_email
- A seeker pin or listing can produce multiple matches over its lifetime, not one-and-done, until marked matched/rented — via the owner's magic link (Section 3.6), since there's no other mechanism to flip status without an account system

---

## 8. Open questions

1. **Matching score weights** — exact soft-ranking weights for preference overlap (e.g. does food preference matter more than smoking preference?) are deliberately left untuned for now; will be set once implementation starts and there's something concrete to test against, rather than guessed at on paper.

---

## 9. Tech notes (rental-layer specific)

- **Email provider: Resend, free tier** — 3,000 emails/month, 100/day cap, no credit card required. Used for: manage-link emails on listing/seeker pin creation (Section 3.6), and match notification emails (Section 7). React Email integration fits naturally with the existing Next.js stack, so templates are React components rather than raw HTML strings.
- Comfortably covers volume at the current 1 pin/day/IP rate limit — revisit only if usage grows enough to approach the daily cap.
- Known risk, not a launch blocker: Resend is VC-backed and has changed pricing before (a documented tier doubled in cost in 2024). Worth keeping an eye on if this scales well past Phase 1/2, but irrelevant at current volume.
- **Geocoding provider: Nominatim (OpenStreetMap), free public API** — powers the location search bar (Section 3.8). No key, no billing, consistent with the OpenFreeMap map tiles. Must be called through a server-side route respecting Nominatim's usage policy (1 req/sec, proper User-Agent) rather than directly from the browser. Weaker informal-address handling than a paid geocoder like Google — accepted trade-off for launch, same reasoning as the original map-stack decision.