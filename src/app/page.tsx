'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import CategoryFilter from '@/components/CategoryFilter';
import PinDropForm from '@/components/PinDropForm';
import PinDetail from '@/components/PinDetail';
import { Category, NewPinInput, Pin, Tag } from '@/types/pin';

// MapLibre touches window/DOM APIs — must be client-only, no SSR.
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export default function HomePage() {
  const [allPins, setAllPins] = useState<Pin[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [dropLocation, setDropLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [totalPins, setTotalPins] = useState<number | null>(null);

  const loadPins = useCallback(async (b: Bounds) => {
    const params = new URLSearchParams({
      minLng: String(b.minLng),
      minLat: String(b.minLat),
      maxLng: String(b.maxLng),
      maxLat: String(b.maxLat),
    });
    const res = await fetch(`/api/pins?${params}`);
    if (!res.ok) return;
    const { pins } = await res.json();
    setAllPins(pins);
  }, []);

  useEffect(() => {
    if (bounds) loadPins(bounds);
  }, [bounds, loadPins]);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => setTotalPins(d.totalPins))
      .catch(() => {});
  }, []);

  const visiblePins =
    activeCategory === 'all' ? allPins : allPins.filter((p) => p.category === activeCategory);

  const handleSubmitPin = async (input: {
    category: Category;
    name: string;
    one_liner: string;
    tags: Tag[];
  }) => {
    if (!dropLocation) return;
    const payload: NewPinInput = { ...input, lat: dropLocation.lat, lng: dropLocation.lng };
    const res = await fetch('/api/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to create pin');
    }
    const { pin } = await res.json();
    setAllPins((prev) => [pin, ...prev]);
    setTotalPins((prev) => (prev ?? 0) + 1);
    setDropLocation(null);
  };

  const handleVote = async (target: 'pin' | 'photo', direction: 'up' | 'down') => {
    if (!selectedPin) return;
    const res = await fetch(`/api/pins/${selectedPin.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, direction }),
    });
    if (!res.ok) return;
    const { pin } = await res.json();
    setSelectedPin(pin);
    setAllPins((prev) => prev.map((p) => (p.id === pin.id ? pin : p)));
  };

  const handleReport = async () => {
    if (!selectedPin) return;
    await fetch(`/api/pins/${selectedPin.id}/report`, { method: 'POST' });
    setSelectedPin(null);
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        pins={visiblePins}
        onMapClick={(lat, lng) => setDropLocation({ lat, lng })}
        onPinClick={setSelectedPin}
        onBoundsChange={setBounds}
      />

      {/* Top bar: brand + live stats */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto rounded-full bg-white/90 px-4 py-2 shadow-md backdrop-blur">
          <span className="text-sm font-semibold tracking-tight text-stone-900">ggn.life</span>
        </div>
        {totalPins !== null && (
          <div className="pointer-events-auto rounded-full bg-white/90 px-4 py-2 text-xs text-stone-600 shadow-md backdrop-blur">
            {totalPins.toLocaleString()} places pinned across Gurgaon
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-4">
        <CategoryFilter active={activeCategory} onChange={setActiveCategory} />
      </div>

      {/* Tap-to-drop hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <p className="pointer-events-auto rounded-full bg-stone-900/90 px-4 py-2 text-xs text-white shadow-md">
          Tap anywhere on the map to drop a pin
        </p>
      </div>

      {dropLocation && (
        <PinDropForm
          lat={dropLocation.lat}
          lng={dropLocation.lng}
          onCancel={() => setDropLocation(null)}
          onSubmit={handleSubmitPin}
        />
      )}

      {selectedPin && (
        <PinDetail
          pin={selectedPin}
          onClose={() => setSelectedPin(null)}
          onVote={handleVote}
          onReport={handleReport}
        />
      )}
    </main>
  );
}
