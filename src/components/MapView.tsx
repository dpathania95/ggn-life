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

// Clustering ignores pin type entirely — a cluster badge is just "N pins
// near here" regardless of whether they're rent pins, listings, or seeker
// pins, so it gets one neutral color rather than reusing any pin-type or
// BHK color (which would misleadingly suggest the cluster is one type/BHK).
const CLUSTER_COLOR = '#1f2937';

// Pins within this many screen pixels of each other collapse into one
// cluster badge — recomputed on 'zoomend' since pixel distance between two
// fixed coordinates changes with zoom (panning alone doesn't affect it, so
// there's no need to recompute on plain moves).
const CLUSTER_PIXEL_RADIUS = 50;
const CLUSTER_ZOOM_STEP = 3;

interface ClusterGroup<T> {
  items: T[];
  lng: number;
  lat: number;
}

// Greedy, not a true nearest-neighbor clustering (a point can join a group
// via just one close neighbor, so a cluster's total spread can exceed 2×
// radius) — an acceptable approximation for decluttering a few dozen to a
// few hundred pins, not worth a real clustering library at this scale.
function clusterByPixelDistance<T>(
  map: MLMap,
  items: T[],
  getLngLat: (item: T) => [number, number]
): ClusterGroup<T>[] {
  const points = items.map((item) => {
    const [lng, lat] = getLngLat(item);
    const { x, y } = map.project([lng, lat]);
    return { item, lng, lat, x, y };
  });

  const used = new Array(points.length).fill(false);
  const clusters: ClusterGroup<T>[] = [];

  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const group = [points[i]];

    for (let j = i + 1; j < points.length; j++) {
      if (used[j]) continue;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      if (Math.sqrt(dx * dx + dy * dy) <= CLUSTER_PIXEL_RADIUS) {
        used[j] = true;
        group.push(points[j]);
      }
    }

    clusters.push({
      items: group.map((p) => p.item),
      lng: group.reduce((sum, p) => sum + p.lng, 0) / group.length,
      lat: group.reduce((sum, p) => sum + p.lat, 0) / group.length,
    });
  }

  return clusters;
}

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

// Tags each pin with its type so the combined, type-agnostic clustering
// pass (all three lists merged into one) can still dispatch to the right
// styling/click-handler once a cluster resolves down to a single pin.
type MapPin =
  | { kind: 'rent'; data: RentPin }
  | { kind: 'listing'; data: Listing }
  | { kind: 'seeker'; data: SeekerPin };

function pinKey(pin: MapPin): string {
  return `${pin.kind}:${pin.data.id}`;
}

function createMarkerForPin(
  pin: MapPin,
  handlers: {
    onRentPinClick: (pin: RentPin) => void;
    onListingClick: (listing: Listing) => void;
    onSeekerPinClick: (pin: SeekerPin) => void;
  }
): HTMLButtonElement {
  switch (pin.kind) {
    case 'rent': {
      const p = pin.data;
      return createPinMarker({
        fill: BHK_COLORS[p.bhk],
        border: p.is_outlier ? `2px dashed ${MARKER_OUTLIER_BORDER}` : null,
        label: `${BHK_LABELS[p.bhk]}BHK · ₹${Math.round(p.rent / 1000)}k`,
        ariaLabel: `₹${p.rent.toLocaleString('en-IN')}/mo · ${BHK_LABELS[p.bhk]} BHK${p.is_outlier ? ' (unverified)' : ''}`,
        onClick: () => handlers.onRentPinClick(p),
      });
    }
    case 'listing': {
      const l = pin.data;
      return createPinMarker({
        fill: BHK_COLORS[l.bhk],
        border: null,
        label: `${BHK_LABELS[l.bhk]}BHK · ₹${Math.round(l.rent / 1000)}k`,
        ariaLabel: `Listing: ₹${l.rent.toLocaleString('en-IN')}/mo · ${BHK_LABELS[l.bhk]} BHK · ${
          l.type === 'whole_flat' ? 'Whole flat' : 'Room'
        }`,
        onClick: () => handlers.onListingClick(l),
      });
    }
    case 'seeker': {
      const p = pin.data;
      const seekingLabel = p.seeker_type === 'full_flat' && p.bhk ? `${BHK_LABELS[p.bhk]}BHK` : 'Flatmate';
      const budgetLabel = `₹${Math.round(p.budget_min / 1000)}–${Math.round(p.budget_max / 1000)}k`;
      return createPinMarker({
        fill: MARKER_SEEKER_PIN,
        border: null,
        label: `${budgetLabel} · ${seekingLabel}`,
        ariaLabel: `Seeking: ₹${p.budget_min.toLocaleString('en-IN')}–${p.budget_max.toLocaleString('en-IN')}/mo · ${seekingLabel}`,
        onClick: () => handlers.onSeekerPinClick(p),
      });
    }
  }
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
  // Individual (non-clustered) pin markers persist across renders, keyed by
  // a stable "kind:id" — a pin whose cluster membership hasn't changed
  // keeps its existing DOM marker untouched instead of being torn down and
  // recreated. Cluster badges have no stable identity across renders
  // (membership shifts with every zoom/pan) so they're simply rebuilt each
  // time; there are usually far fewer of them than individual pins.
  const individualMarkersRef = useRef<Map<string, Marker>>(new Map());
  const clusterMarkersRef = useRef<Marker[]>([]);

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

  // Re-render markers whenever any pin list changes (or the map finishes
  // zooming, since that changes which pins cluster together). Clustering
  // runs across ALL pin types together — a cluster is just "N pins near
  // here" regardless of type — so this is one combined pass, not three.
  //
  // Individual pins that were already on the map and are still shown
  // individually (not newly clustered/unclustered) keep their existing DOM
  // marker rather than being torn down and recreated — this used to
  // rebuild every marker on every zoomend AND on every viewport refetch
  // (which fires on plain pans too, not just zooms), which was the actual
  // source of the lag: DOM churn on markers that hadn't visually changed
  // at all, not the O(n²) clustering math itself (cheap at this pin count).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      const allPins: MapPin[] = [
        ...rentPins.map((data): MapPin => ({ kind: 'rent', data })),
        ...listings.map((data): MapPin => ({ kind: 'listing', data })),
        ...seekerPins.map((data): MapPin => ({ kind: 'seeker', data })),
      ];

      const clusters = clusterByPixelDistance(map, allPins, (pin) => [pin.data.lng, pin.data.lat]);

      const keepKeys = new Set<string>();
      const newClusterMarkers: Marker[] = [];

      clusters.forEach((cluster) => {
        if (cluster.items.length === 1) {
          const pin = cluster.items[0];
          const key = pinKey(pin);
          keepKeys.add(key);
          if (individualMarkersRef.current.has(key)) return; // unchanged — reuse as-is

          const el = createMarkerForPin(pin, { onRentPinClick, onListingClick, onSeekerPinClick });
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([pin.data.lng, pin.data.lat])
            .addTo(map);
          individualMarkersRef.current.set(key, marker);
        } else {
          const lngLat: [number, number] = [cluster.lng, cluster.lat];
          const count = cluster.items.length;
          const el = createPinMarker({
            fill: CLUSTER_COLOR,
            border: null,
            label: `${count} flats`,
            ariaLabel: `${count} pins in this area — click to zoom in`,
            onClick: () => map.easeTo({ center: lngLat, zoom: map.getZoom() + CLUSTER_ZOOM_STEP }),
          });
          newClusterMarkers.push(new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map));
        }
      });

      // Drop individual markers that are no longer shown individually
      // (now clustered, or removed from the underlying data).
      for (const [key, marker] of individualMarkersRef.current) {
        if (!keepKeys.has(key)) {
          marker.remove();
          individualMarkersRef.current.delete(key);
        }
      }

      // Cluster badges have no stable identity across renders, so they're
      // always fully replaced — cheap, since there are usually few of them.
      clusterMarkersRef.current.forEach((m) => m.remove());
      clusterMarkersRef.current = newClusterMarkers;
    };

    render();
    map.on('zoomend', render);
    return () => {
      map.off('zoomend', render);
    };
  }, [rentPins, listings, seekerPins, onRentPinClick, onListingClick, onSeekerPinClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
