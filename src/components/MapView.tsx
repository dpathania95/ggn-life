'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Listing, RentPin, SeekerPin } from '@/types/rental';

// Free, no API key, no per-load billing — see spec Section 9a.
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Gurgaon-wide default view, per the locked "no zone restriction" decision.
const GURGAON_CENTER: [number, number] = [77.0266, 28.4595];
const GURGAON_DEFAULT_ZOOM = 12;
const SEARCH_FLY_TO_ZOOM = 15;

// Categorical marker palette — validated with the dataviz skill's
// validate_palette.js (OKLab CVD + normal-vision separation, contrast vs
// surface, --pairs all since any two marker types can sit side by side on
// the map). MARKER_OUTLIER is a status color (not part of the categorical
// set), deliberately distinct from all three so it never impersonates a
// series — it replaces MARKER_RENT_PIN only on flagged rent pins, never
// shown alongside it for the same marker.
const MARKER_RENT_PIN = '#5851d3'; // violet — brand color, doubles as slot 1
const MARKER_LISTING = '#2f8f5b'; // green — slot 2
const MARKER_SEEKER_PIN = '#e87ba4'; // magenta — slot 3
const MARKER_OUTLIER = '#c99a2e'; // gold — status/warning, reserved
const MARKER_OUTLIER_BORDER = '#8f6c1c'; // darker gold, so the dashed ring reads against the fill

interface MapViewProps {
  rentPins: RentPin[];
  listings: Listing[];
  seekerPins: SeekerPin[];
  flyTo: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  onRentPinClick: (pin: RentPin) => void;
  onListingClick: (listing: Listing) => void;
  onSeekerPinClick: (pin: SeekerPin) => void;
  onBoundsChange: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }) => void;
}

export default function MapView({
  rentPins,
  listings,
  seekerPins,
  flyTo,
  onMapClick,
  onRentPinClick,
  onListingClick,
  onSeekerPinClick,
  onBoundsChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const rentMarkersRef = useRef<Marker[]>([]);
  const listingMarkersRef = useRef<Marker[]>([]);
  const seekerMarkersRef = useRef<Marker[]>([]);

  // The map's 'click' listener is attached once below and must never see a
  // stale closure — onMapClick now depends on activeFlow (armed entry-flow
  // state), which changes after mount. Route through a ref that's kept
  // current every render instead of re-running the mount effect (that would
  // tear down and recreate the whole MapLibre instance on every click).
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: GURGAON_CENTER,
      zoom: GURGAON_DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');

    map.on('click', (e) => {
      onMapClickRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    const emitBounds = () => {
      const b = map.getBounds();
      onBoundsChange({
        minLng: b.getWest(),
        minLat: b.getSouth(),
        maxLng: b.getEast(),
        maxLat: b.getNorth(),
      });
    };

    map.on('moveend', emitBounds);
    map.on('load', emitBounds);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Location search (spec Section 3.8) — recenters the map, doesn't filter
  useEffect(() => {
    if (!flyTo) return;
    mapRef.current?.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: SEARCH_FLY_TO_ZOOM });
  }, [flyTo]);

  // Re-render rent pin markers whenever the pin list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    rentMarkersRef.current.forEach((m) => m.remove());
    rentMarkersRef.current = [];

    rentPins.forEach((pin) => {
      const el = document.createElement('button');
      el.setAttribute(
        'aria-label',
        `₹${pin.rent.toLocaleString('en-IN')}/mo · ${pin.bhk} BHK${pin.is_outlier ? ' (unverified)' : ''}`
      );
      el.style.width = '30px';
      el.style.height = '20px';
      el.style.borderRadius = '10px';
      el.style.border = pin.is_outlier ? `2px dashed ${MARKER_OUTLIER_BORDER}` : '2px solid white';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
      el.style.background = pin.is_outlier ? MARKER_OUTLIER : MARKER_RENT_PIN;
      el.style.color = 'white';
      el.style.fontSize = '9px';
      el.style.fontWeight = '600';
      el.style.lineHeight = '18px';
      el.style.textAlign = 'center';
      el.style.cursor = 'pointer';
      el.textContent = `₹${Math.round(pin.rent / 1000)}k`;
      el.onclick = (evt) => {
        evt.stopPropagation();
        onRentPinClick(pin);
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      rentMarkersRef.current.push(marker);
    });
  }, [rentPins, onRentPinClick]);

  // Re-render listing markers whenever the listing list changes — visually
  // distinct from rent pins (square vs pill, green vs violet) since a listing
  // is an addressable property, not an anonymous data point (spec Section 3.1).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    listingMarkersRef.current.forEach((m) => m.remove());
    listingMarkersRef.current = [];

    listings.forEach((listing) => {
      const el = document.createElement('button');
      el.setAttribute(
        'aria-label',
        `Listing: ₹${listing.rent.toLocaleString('en-IN')}/mo · ${listing.bhk} BHK · ${
          listing.type === 'whole_flat' ? 'Whole flat' : 'Room'
        }`
      );
      el.style.width = '30px';
      el.style.height = '20px';
      el.style.borderRadius = '4px';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
      el.style.background = MARKER_LISTING;
      el.style.color = 'white';
      el.style.fontSize = '9px';
      el.style.fontWeight = '600';
      el.style.lineHeight = '18px';
      el.style.textAlign = 'center';
      el.style.cursor = 'pointer';
      el.textContent = `₹${Math.round(listing.rent / 1000)}k`;
      el.onclick = (evt) => {
        evt.stopPropagation();
        onListingClick(listing);
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([listing.lng, listing.lat])
        .addTo(map);

      listingMarkersRef.current.push(marker);
    });
  }, [listings, onListingClick]);

  // Re-render seeker pin markers whenever the list changes — anonymized
  // budget/BHK bubble (spec Section 3.9: "rendered as a budget/BHK bubble
  // ... no name or contact shown"), dashed border keeps it visually
  // distinct from rent pins/listings as a want-ad rather than a data point.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    seekerMarkersRef.current.forEach((m) => m.remove());
    seekerMarkersRef.current = [];

    seekerPins.forEach((pin) => {
      const el = document.createElement('button');
      const seekingLabel = pin.seeker_type === 'full_flat' && pin.bhk ? `${pin.bhk}BHK` : 'Flatmate';
      const budgetLabel = `₹${Math.round(pin.budget_min / 1000)}–${Math.round(pin.budget_max / 1000)}k`;
      el.setAttribute(
        'aria-label',
        `Seeking: ₹${pin.budget_min.toLocaleString('en-IN')}–${pin.budget_max.toLocaleString('en-IN')}/mo · ${seekingLabel}`
      );
      el.style.height = '20px';
      el.style.padding = '0 6px';
      el.style.borderRadius = '10px';
      el.style.border = `2px dashed white`;
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
      el.style.background = MARKER_SEEKER_PIN;
      el.style.color = 'white';
      el.style.fontSize = '9px';
      el.style.fontWeight = '600';
      el.style.lineHeight = '16px';
      el.style.whiteSpace = 'nowrap';
      el.style.textAlign = 'center';
      el.style.cursor = 'pointer';
      el.textContent = `${budgetLabel} · ${seekingLabel}`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      el.onclick = (evt) => {
        evt.stopPropagation();
        onSeekerPinClick(pin);
      };

      seekerMarkersRef.current.push(marker);
    });
  }, [seekerPins, onSeekerPinClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
