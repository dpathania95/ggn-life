'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

interface SearchBarProps {
  onSelect: (lat: number, lng: number) => void;
}

// Location search bar (spec Section 3.8) — recenters the map on a result,
// does not filter what's shown (that's FilterPanel's job, spec Section 3.9).
export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup only — debouncing itself runs from the input handler below, not
  // an Effect, so setState stays out of the Effect body.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(value)}`)
        .then((res) => res.json())
        .then((data: { results?: GeocodeResult[] }) => {
          setResults(data.results ?? []);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 400);
  };

  const handleSelect = (r: GeocodeResult) => {
    onSelect(r.lat, r.lng);
    setQuery(r.label);
    setOpen(false);
  };

  return (
    <div className="pointer-events-auto relative w-[500px] max-w-md">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 z-1" />
      <input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search a place or society…"
        className="w-full rounded-2xl border border-stone-200 bg-white/90 py-3 pl-11 pr-5 text-base shadow-md backdrop-blur focus:outline-none"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 top-full mt-1 w-full overflow-hidden rounded-xl bg-white shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-100"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
