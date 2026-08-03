'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import DropChooser from '@/components/DropChooser';
import RentPinForm from '@/components/RentPinForm';
import RentPinDetail from '@/components/RentPinDetail';
import ListingForm from '@/components/ListingForm';
import ListingDetail from '@/components/ListingDetail';
import SeekerPinForm from '@/components/SeekerPinForm';
import SeekerPinDetail from '@/components/SeekerPinDetail';
import SearchBar from '@/components/SearchBar';
import FilterPanel from '@/components/FilterPanel';
import { DEFAULT_FILTERS, DEFAULT_LAYERS, matchesListingFilters, matchesRentPinFilters } from '@/lib/filterPins';
import {
  Listing,
  NewListingInput,
  NewRentPinInput,
  NewSeekerPinInput,
  RentPin,
  SeekerPin,
} from '@/types/rental';

// MapLibre touches window/DOM APIs — must be client-only, no SSR.
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };
type DropFlow = 'choose' | 'rent_pin' | 'listing' | 'seeker_pin';

export default function HomePage() {
  const [rentPins, setRentPins] = useState<RentPin[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [seekerPins, setSeekerPins] = useState<SeekerPin[]>([]);
  const [dropLocation, setDropLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dropFlow, setDropFlow] = useState<DropFlow>('choose');
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

  const closeDropFlow = () => {
    setDropLocation(null);
    setDropFlow('choose');
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
  // against the already viewport-bounded fetch; seeker pins aren't filtered
  // by BHK/budget/etc, only shown/hidden via the layer toggle.
  const visibleRentPins = useMemo(
    () => (layers.rentPins ? rentPins.filter((p) => matchesRentPinFilters(filters, p)) : []),
    [rentPins, layers.rentPins, filters]
  );
  const visibleListings = useMemo(
    () => (layers.listings ? listings.filter((l) => matchesListingFilters(filters, l)) : []),
    [listings, layers.listings, filters]
  );
  const visibleSeekerPins = useMemo(
    () => (layers.seekerPins ? seekerPins : []),
    [seekerPins, layers.seekerPins]
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        rentPins={visibleRentPins}
        listings={visibleListings}
        seekerPins={visibleSeekerPins}
        flyTo={flyTo}
        onMapClick={(lat, lng) => {
          setDropLocation({ lat, lng });
          setDropFlow('choose');
        }}
        onRentPinClick={setSelectedPin}
        onListingClick={setSelectedListing}
        onSeekerPinClick={setSelectedSeekerPin}
        onBoundsChange={handleBoundsChange}
      />

      {/* Top bar: brand, search (spec 3.8), filters toggle (spec 3.9).
          Right padding clears MapLibre's top-right zoom/geolocate controls. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-4 pr-16">
        <div className="pointer-events-auto rounded-full bg-white/90 px-4 py-2 shadow-md backdrop-blur">
          <span className="text-sm font-semibold tracking-tight text-stone-900">ggn.life</span>
        </div>
        <SearchBar onSelect={(lat, lng) => setFlyTo({ lat, lng })} />
        <button
          onClick={() => setFiltersOpen(true)}
          className="pointer-events-auto rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-stone-900 shadow-md backdrop-blur"
        >
          Filters
        </button>
      </div>

      {/* Tap-to-drop hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <p className="pointer-events-auto rounded-full bg-stone-900/90 px-4 py-2 text-xs text-white shadow-md">
          Tap anywhere on the map to share, list, or search
        </p>
      </div>

      {filtersOpen && (
        <FilterPanel
          layers={layers}
          onLayersChange={setLayers}
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {dropLocation && dropFlow === 'choose' && (
        <DropChooser
          onCancel={closeDropFlow}
          onChooseRentPin={() => setDropFlow('rent_pin')}
          onChooseListing={() => setDropFlow('listing')}
          onChooseSeekerPin={() => setDropFlow('seeker_pin')}
        />
      )}

      {dropLocation && dropFlow === 'rent_pin' && (
        <RentPinForm
          lat={dropLocation.lat}
          lng={dropLocation.lng}
          onCancel={closeDropFlow}
          onSubmit={handleSubmitRentPin}
        />
      )}

      {dropLocation && dropFlow === 'listing' && (
        <ListingForm
          lat={dropLocation.lat}
          lng={dropLocation.lng}
          onCancel={closeDropFlow}
          onSubmit={handleSubmitListing}
        />
      )}

      {dropLocation && dropFlow === 'seeker_pin' && (
        <SeekerPinForm
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
        <ListingDetail listing={selectedListing} onClose={() => setSelectedListing(null)} />
      )}

      {selectedSeekerPin && (
        <SeekerPinDetail pin={selectedSeekerPin} onClose={() => setSelectedSeekerPin(null)} />
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
