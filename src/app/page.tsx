'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import RentPinForm from '@/components/RentPinForm';
import RentPinDetail from '@/components/RentPinDetail';
import ListingForm from '@/components/ListingForm';
import ListingDetail from '@/components/ListingDetail';
import SeekerPinForm from '@/components/SeekerPinForm';
import SeekerPinDetail from '@/components/SeekerPinDetail';
import SeekerTypeChooser from '@/components/SeekerTypeChooser';
import SearchBar from '@/components/SearchBar';
import FilterPanel from '@/components/FilterPanel';
import AreaStats from '@/components/AreaStats';
import { Filter, Home, IndianRupee, Users } from 'lucide-react';
import {
  DEFAULT_FILTERS,
  DEFAULT_LAYERS,
  matchesListingFilters,
  matchesRentPinFilters,
  matchesSeekerPinFilters,
} from '@/lib/filterPins';
import {
  Listing,
  NewListingInput,
  NewRentPinInput,
  NewSeekerPinInput,
  RentPin,
  SeekerPin,
  SeekerType,
} from '@/types/rental';

// MapLibre touches window/DOM APIs — must be client-only, no SSR.
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };
type EntryFlow = 'rent_pin' | 'listing' | 'seeker_pin';

const ENTRY_FLOWS: { flow: EntryFlow; label: string; icon: typeof IndianRupee }[] = [
  { flow: 'rent_pin', label: 'What I pay', icon: IndianRupee },
  { flow: 'listing', label: 'List a flat', icon: Home },
  { flow: 'seeker_pin', label: 'Find a place', icon: Users },
];

export default function HomePage() {
  const [rentPins, setRentPins] = useState<RentPin[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [seekerPins, setSeekerPins] = useState<SeekerPin[]>([]);
  const [dropLocation, setDropLocation] = useState<{ lat: number; lng: number } | null>(null);
  // Entry-point flow (spec Section 3.7, reworked): a flow must be armed via
  // one of the three buttons below before a map tap does anything at all —
  // no armed flow means tapping the map is a no-op.
  const [activeFlow, setActiveFlow] = useState<EntryFlow | null>(null);
  // Second branching step for seeker pins only (spec Section 3.3/3.7),
  // shown after the map tap — "Full flat, or a flatmate?"
  const [seekerType, setSeekerType] = useState<SeekerType | null>(null);
  const [selectedPin, setSelectedPin] = useState<RentPin | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedSeekerPin, setSelectedSeekerPin] = useState<SeekerPin | null>(null);
  const [manageInfo, setManageInfo] = useState<{ token: string; kind: 'listing' | 'seeker_pin' } | null>(
    null
  );
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [areaStatsOpen, setAreaStatsOpen] = useState(false);

  const loadRentPins = useCallback(async (b: Bounds) => {
    const params = new URLSearchParams({
      minLng: String(b.minLng),
      minLat: String(b.minLat),
      maxLng: String(b.maxLng),
      maxLat: String(b.maxLat),
    });
    const res = await fetch(`/api/rent-pins?${params}`);
    if (!res.ok) return;
    const { rentPins: pins } = await res.json();
    setRentPins(pins);
  }, []);

  const loadListings = useCallback(async (b: Bounds) => {
    const params = new URLSearchParams({
      minLng: String(b.minLng),
      minLat: String(b.minLat),
      maxLng: String(b.maxLng),
      maxLat: String(b.maxLat),
    });
    const res = await fetch(`/api/listings?${params}`);
    if (!res.ok) return;
    const { listings: rows } = await res.json();
    setListings(rows);
  }, []);

  const loadSeekerPins = useCallback(async (b: Bounds) => {
    const params = new URLSearchParams({
      minLng: String(b.minLng),
      minLat: String(b.minLat),
      maxLng: String(b.maxLng),
      maxLat: String(b.maxLat),
    });
    const res = await fetch(`/api/seeker-pins?${params}`);
    if (!res.ok) return;
    const { seekerPins: rows } = await res.json();
    setSeekerPins(rows);
  }, []);

  const handleBoundsChange = useCallback(
    (b: Bounds) => {
      loadRentPins(b);
      loadListings(b);
      loadSeekerPins(b);
    },
    [loadRentPins, loadListings, loadSeekerPins]
  );

  // Closes the open form and disarms the entry flow — the next map tap is a
  // no-op again until a flow button is clicked.
  const closeDropFlow = () => {
    setDropLocation(null);
    setActiveFlow(null);
    setSeekerType(null);
  };

  const handleSubmitRentPin = async (input: Omit<NewRentPinInput, 'lat' | 'lng'>) => {
    if (!dropLocation) return;
    const payload: NewRentPinInput = { ...input, lat: dropLocation.lat, lng: dropLocation.lng };
    const res = await fetch('/api/rent-pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to share rent pin');
    }
    const { rentPin } = await res.json();
    setRentPins((prev) => [rentPin, ...prev]);
    closeDropFlow();
  };

  const handleReportRentPin = async (pinId: string) => {
    const res = await fetch(`/api/rent-pins/${pinId}/report`, { method: 'POST' });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to report');
    }
    const { rentPin } = await res.json();
    if (rentPin.hidden) {
      setRentPins((prev) => prev.filter((p) => p.id !== pinId));
      setSelectedPin(null);
    }
  };

  const handleInterestListing = async (listingId: string, email: string) => {
    const res = await fetch(`/api/listings/${listingId}/interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_email: email }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to send interest request');
    }
  };

  const handleInterestSeekerPin = async (seekerPinId: string, email: string) => {
    const res = await fetch(`/api/seeker-pins/${seekerPinId}/interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_email: email }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to send interest request');
    }
  };

  const handleSubmitListing = async (input: Omit<NewListingInput, 'lat' | 'lng'>) => {
    if (!dropLocation) return;
    const payload: NewListingInput = { ...input, lat: dropLocation.lat, lng: dropLocation.lng };
    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to post listing');
    }
    const { listing, manageToken: token } = await res.json();
    setListings((prev) => [listing, ...prev]);
    setManageInfo({ token, kind: 'listing' });
    closeDropFlow();
  };

  const handleSubmitSeekerPin = async (input: Omit<NewSeekerPinInput, 'lat' | 'lng'>) => {
    if (!dropLocation) return;
    const payload: NewSeekerPinInput = { ...input, lat: dropLocation.lat, lng: dropLocation.lng };
    const res = await fetch('/api/seeker-pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to start matching');
    }
    const { seekerPin, manageToken: token } = await res.json();
    setSeekerPins((prev) => [seekerPin, ...prev]);
    setManageInfo({ token, kind: 'seeker_pin' });
    closeDropFlow();
  };

  // Layer toggle + filters (spec Section 3.9) — filtering runs client-side
  // against the already viewport-bounded fetch.
  const visibleRentPins = useMemo(
    () => (layers.rentPins ? rentPins.filter((p) => matchesRentPinFilters(filters, p)) : []),
    [rentPins, layers.rentPins, filters]
  );
  const visibleListings = useMemo(
    () => (layers.listings ? listings.filter((l) => matchesListingFilters(filters, l)) : []),
    [listings, layers.listings, filters]
  );
  const visibleSeekerPins = useMemo(
    () => (layers.seekerPins ? seekerPins.filter((p) => matchesSeekerPinFilters(filters, p)) : []),
    [seekerPins, layers.seekerPins, filters]
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        rentPins={visibleRentPins}
        listings={visibleListings}
        seekerPins={visibleSeekerPins}
        flyTo={flyTo}
        onMapClick={(lat, lng) => {
          // No armed flow → tapping the map does nothing (spec change: the
          // old tap-anywhere chooser is gone, flows are armed via the
          // buttons below instead).
          if (!activeFlow) return;
          setDropLocation({ lat, lng });
        }}
        onRentPinClick={setSelectedPin}
        onListingClick={setSelectedListing}
        onSeekerPinClick={setSelectedSeekerPin}
        onBoundsChange={handleBoundsChange}
      />

      {/* Top bar: brand, search+filters grouped (spec 3.8/3.9), stats +
          entry-flow buttons below that group and smaller. Right padding
          clears MapLibre's top-right zoom/geolocate controls. */}
      <div
        className="pointer-events-auto absolute top-5 flex flex-col items-center gap-2 left-2/4"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div className="flex items-center gap-1.5 w-full">
          <SearchBar onSelect={(lat, lng) => setFlyTo({ lat, lng })} />
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 text-sm font-medium text-stone-900 shadow-md backdrop-blur cursor-pointer"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAreaStatsOpen(true)}
            className="rounded-full border border-stone-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-stone-900 shadow-md backdrop-blur cursor-pointer"
          >
            Stats
          </button>
          {ENTRY_FLOWS.map(({ flow, label, icon: Icon }) => (
            <button
              key={flow}
              onClick={() => {
                // Switching flows via these buttons (not Cancel/✕) must
                // also clear any drop-in-progress state — otherwise a
                // stale dropLocation/seekerType from a previous flow skips
                // tap-to-drop (or the seeker sub-type chooser) entirely.
                setActiveFlow((prev) => (prev === flow ? null : flow));
                setDropLocation(null);
                setSeekerType(null);
              }}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur transition cursor-pointer ${
                activeFlow === flow
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-stone-200 bg-white/90 text-stone-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tap-to-drop hint — only shown once a flow is armed */}
      {activeFlow && !dropLocation && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <p className="pointer-events-auto rounded-full bg-stone-900/90 px-4 py-2 text-xs text-white shadow-md">
            Tap anywhere on the map to drop your pin
          </p>
        </div>
      )}

      {filtersOpen && (
        <FilterPanel
          layers={layers}
          onLayersChange={setLayers}
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {areaStatsOpen && <AreaStats onClose={() => setAreaStatsOpen(false)} />}

      {dropLocation && activeFlow === 'rent_pin' && (
        <RentPinForm
          lat={dropLocation.lat}
          lng={dropLocation.lng}
          onCancel={closeDropFlow}
          onSubmit={handleSubmitRentPin}
        />
      )}

      {dropLocation && activeFlow === 'listing' && (
        <ListingForm
          lat={dropLocation.lat}
          lng={dropLocation.lng}
          onCancel={closeDropFlow}
          onSubmit={handleSubmitListing}
        />
      )}

      {dropLocation && activeFlow === 'seeker_pin' && !seekerType && (
        <SeekerTypeChooser onSelect={setSeekerType} onCancel={closeDropFlow} />
      )}

      {dropLocation && activeFlow === 'seeker_pin' && seekerType && (
        <SeekerPinForm
          seekerType={seekerType}
          lat={dropLocation.lat}
          lng={dropLocation.lng}
          onCancel={closeDropFlow}
          onSubmit={handleSubmitSeekerPin}
        />
      )}

      {selectedPin && (
        <RentPinDetail
          pin={selectedPin}
          onClose={() => setSelectedPin(null)}
          onReport={() => handleReportRentPin(selectedPin.id)}
        />
      )}

      {selectedListing && (
        <ListingDetail
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onInterest={(email) => handleInterestListing(selectedListing.id, email)}
        />
      )}

      {selectedSeekerPin && (
        <SeekerPinDetail
          pin={selectedSeekerPin}
          onClose={() => setSelectedSeekerPin(null)}
          onInterest={(email) => handleInterestSeekerPin(selectedSeekerPin.id, email)}
        />
      )}

      {/* Manage-link stand-in until email integration exists (spec Section 3.6) */}
      {manageInfo && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 sm:bottom-4">
          <div className="w-full max-w-md rounded-xl bg-stone-900 p-4 text-white shadow-xl">
            <p className="mb-1 text-sm font-medium">
              {manageInfo.kind === 'listing' ? 'Listing posted!' : "You're in the matching pool!"}
            </p>
            <p className="mb-2 text-xs text-stone-300">
              Save this manage token now — email delivery isn&apos;t wired up yet, so this is the only
              copy. You&apos;ll need it later to mark this{' '}
              {manageInfo.kind === 'listing' ? 'listing rented' : 'search matched'} or delete it.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-stone-800 px-2 py-1 text-xs">
                {manageInfo.token}
              </code>
              <button
                onClick={() => setManageInfo(null)}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-900"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
