'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Pin, CATEGORY_LABELS } from '@/types/pin';

// Free, no API key, no per-load billing — see spec Section 9a.
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Gurgaon-wide default view, per the locked "no zone restriction" decision.
const GURGAON_CENTER: [number, number] = [77.0266, 28.4595];
const GURGAON_DEFAULT_ZOOM = 12;

const CATEGORY_COLORS: Record<string, string> = {
  cafe: '#c2703d',
  park: '#3f7d4f',
  hangout: '#7a5cb5',
  hidden_gem: '#c2483d',
  food: '#3d7ac2',
};

interface MapViewProps {
  pins: Pin[];
  onMapClick: (lat: number, lng: number) => void;
  onPinClick: (pin: Pin) => void;
  onBoundsChange: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }) => void;
}

export default function MapView({ pins, onMapClick, onPinClick, onBoundsChange }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // Init map once
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
      // Ignore clicks that landed on a marker (handled separately)
      onMapClick(e.lngLat.lat, e.lngLat.lng);
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

  // Re-render markers whenever pins change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pins.forEach((pin) => {
      const el = document.createElement('button');
      el.setAttribute('aria-label', `${CATEGORY_LABELS[pin.category]}: ${pin.name}`);
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
      el.style.background = CATEGORY_COLORS[pin.category] ?? '#555';
      el.style.cursor = 'pointer';
      el.onclick = (evt) => {
        evt.stopPropagation();
        onPinClick(pin);
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [pins, onPinClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
