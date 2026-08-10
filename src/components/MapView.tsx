'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Listing, RentBhk, RentPin, SeekerPin } from '@/types/rental';

// Free, no API key, no per-load billing — see spec Section 9a.
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Gurgaon-wide default view, per the locked "no zone restriction" decision.
// Zoom 12 showed well past city limits (Delhi border to the east, rural
// villages to the west) — 13 frames the city's sectors without needing an
// immediate pan.
const GURGAON_CENTER: [number, number] = [77.0266, 28.4595];
const GURGAON_DEFAULT_ZOOM = 11;
const SEARCH_FLY_TO_ZOOM = 15;

// BHK is an ordered/magnitude value (1 < 2 < 3 < 4+), not an unrelated
// category, so it gets a single-hue sequential ramp per the dataviz skill's
// rule ("sequential = one hue, light→dark") rather than 4 arbitrary hues —
// this is also the more colorblind-safe choice, since lightness ordering
// survives every common CVD type far better than hue differences do.
// Shared by rent pins and listings (spec: "different colors for different
// BHK flats"). validate_palette.js wasn't runnable in this environment, so
// contrast was checked by hand instead: white text against every step here
// clears WCAG AA (4.5:1) with margin (5.2:1 at the lightest step up to
// 10.4:1 at the darkest).
const BHK_COLORS: Record<RentBhk, string> = {
  '1': '#2563eb',
  '2': '#0d9488',
  '3': '#d97706',
  '4_plus': '#7123de',
};

// '4_plus' is the enum value, not display text — every marker label/aria
// string below reads through this instead of interpolating pin.bhk directly.
const BHK_LABELS: Record<RentBhk, string> = {
  '1': '1',
  '2': '2',
  '3': '3',
  '4_plus': '4+',
};

// Seeker pins keep their own fixed color — they're want-ads, not "flats",
// and flatmate-type seekers don't even have a BHK to color by.
const MARKER_SEEKER_PIN = '#e87ba4'; // magenta
const MARKER_OUTLIER_BORDER = '#c99a2e'; // gold dashed border — status flag, not a fill override, so the BHK color underneath still reads

// Rounded-rectangle "callout" badge with a small triangle tail pointing
// down to the exact location — matches the pin style on bengaluru.rent,
// shared by all three marker types. MapLibre's default marker anchor
// ('bottom') lines up with the tail's tip since the tail is the last,
// bottommost element in the (unrotated, normal-flow) layout.
function createPinMarker(options: {
  fill: string;
  border: string | null;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}): HTMLButtonElement {
  const el = document.createElement('button');
  el.setAttribute('aria-label', options.ariaLabel);
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.padding = '0';
  el.style.background = 'transparent';
  el.style.border = 'none';
  el.style.cursor = 'pointer';

  const badge = document.createElement('div');
  badge.style.background = options.fill;
  badge.style.border = options.border ?? 'none';
  badge.style.borderRadius = '6px';
  badge.style.padding = '3px 7px';
  badge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
  badge.style.color = 'white';
  badge.style.fontSize = '10px';
  badge.style.fontWeight = '600';
  badge.style.lineHeight = '1.3';
  badge.style.textAlign = 'center';
  badge.style.whiteSpace = 'nowrap';
  badge.innerHTML = options.label;
  el.appendChild(badge);

  const tail = document.createElement('div');
  tail.style.width = '0';
  tail.style.height = '0';
  tail.style.marginTop = '-1px';
  tail.style.borderLeft = '5px solid transparent';
  tail.style.borderRight = '5px solid transparent';
  tail.style.borderTop = `6px solid ${options.fill}`;
  el.appendChild(tail);

  el.onclick = (evt) => {
    evt.stopPropagation();
    options.onClick();
  };

  return el;
}

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
      minZoom: GURGAON_DEFAULT_ZOOM
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

  // Re-render rent pin markers whenever the pin list changes — pin,
  // colored by BHK, with an outlier flag shown as a dashed gold border
  // rather than replacing the fill (so the BHK color still reads).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    rentMarkersRef.current.forEach((m) => m.remove());
    rentMarkersRef.current = [];

    rentPins.forEach((pin) => {
      const el = createPinMarker({
        fill: BHK_COLORS[pin.bhk],
        border: pin.is_outlier ? `2px dashed ${MARKER_OUTLIER_BORDER}` : null,
        label: `${BHK_LABELS[pin.bhk]}BHK · ₹${Math.round(pin.rent / 1000)}k`,
        ariaLabel: `₹${pin.rent.toLocaleString('en-IN')}/mo · ${BHK_LABELS[pin.bhk]} BHK${pin.is_outlier ? ' (unverified)' : ''}`,
        onClick: () => onRentPinClick(pin),
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      rentMarkersRef.current.push(marker);
    });
  }, [rentPins, onRentPinClick]);

  // Re-render listing markers whenever the listing list changes — same
  // pin shape and BHK color scale as rent pins (spec: "different colors
  // for different BHK flats" applies to both), with a small house glyph
  // in the label so a listing doesn't read as a rent pin at a glance.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    listingMarkersRef.current.forEach((m) => m.remove());
    listingMarkersRef.current = [];

    listings.forEach((listing) => {
      const el = createPinMarker({
        fill: BHK_COLORS[listing.bhk],
        border: null,
        label: `${BHK_LABELS[listing.bhk]}BHK · ₹${Math.round(listing.rent / 1000)}k`,
        ariaLabel: `Listing: ₹${listing.rent.toLocaleString('en-IN')}/mo · ${BHK_LABELS[listing.bhk]} BHK · ${
          listing.type === 'whole_flat' ? 'Whole flat' : 'Room'
        }`,
        onClick: () => onListingClick(listing),
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([listing.lng, listing.lat])
        .addTo(map);

      listingMarkersRef.current.push(marker);
    });
  }, [listings, onListingClick]);

  // Re-render seeker pin markers whenever the list changes — same pin
  // shape as rent pins/listings, but a fixed color (not BHK-based, see
  // BHK_COLORS' comment) since it's a want-ad, not a "flat" (spec Section
  // 3.9: "rendered as a budget/BHK bubble ... no name or contact shown").
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    seekerMarkersRef.current.forEach((m) => m.remove());
    seekerMarkersRef.current = [];

    seekerPins.forEach((pin) => {
      const seekingLabel = pin.seeker_type === 'full_flat' && pin.bhk ? `${BHK_LABELS[pin.bhk]}BHK` : 'Flatmate';
      const budgetLabel = `₹${Math.round(pin.budget_min / 1000)}–${Math.round(pin.budget_max / 1000)}k`;

      const el = createPinMarker({
        fill: MARKER_SEEKER_PIN,
        border: null,
        label: `${budgetLabel} · ${seekingLabel}`,
        ariaLabel: `Seeking: ₹${pin.budget_min.toLocaleString('en-IN')}–${pin.budget_max.toLocaleString('en-IN')}/mo · ${seekingLabel}`,
        onClick: () => onSeekerPinClick(pin),
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      seekerMarkersRef.current.push(marker);
    });
  }, [seekerPins, onSeekerPinClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
