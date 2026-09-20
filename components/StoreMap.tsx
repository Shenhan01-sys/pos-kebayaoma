"use client";

// E9: peta pilih titik toko — Leaflet + OpenStreetMap (gratis, tanpa API key).
// Search lokasi via Nominatim (OSM geocoder, gratis) + klik peta langsung.

import { useEffect, useRef, useState } from "react";

interface StoreMapProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function StoreMap({ lat, lng, onPick }: StoreMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const [q, setQ] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  // init sekali
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !divRef.current || mapRef.current) return;
      const start: [number, number] = lat != null && lng != null ? [lat, lng] : [-2.5, 118]; // Indonesia
      const map = L.map(divRef.current, { zoomControl: true }).setView(start, lat != null ? 17 : 5);
      const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      // satelit Esri World Imagery — citra lebih baru, gang/bangunan terlihat nyata (gratis, tanpa key)
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      });
      L.control.layers({ "Jalan (OSM)": osm, "Satelit (Esri)": sat }, undefined, { position: "topleft" }).addTo(map);
      // circleMarker = tidak butuh asset icon (anti masalah bundler)
      const marker = L.circleMarker(start, {
        radius: 12, color: "#290024", weight: 2, fillColor: "#D4954D", fillOpacity: 0.8,
      }).addTo(map);
      map.on("click", (e: any) => {
        const { lat: la, lng: ln } = e.latlng;
        marker.setLatLng([la, ln]);
        onPickRef.current(la, ln);
      });
      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 100);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sinkron saat lat/lng berubah dari luar (tombol GPS / pilih toko / pilih hasil search)
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || lat == null || lng == null) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }, [lat, lng]);

  // search Nominatim (debounce 700 ms — patuh usage policy 1 req/detik)
  // + deteksi paste koordinat "lat, lng" (dari Google Maps long-press → copy)
  useEffect(() => {
    const query = q.trim();
    const coordMatch = query.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const la = parseFloat(coordMatch[1]);
      const ln = parseFloat(coordMatch[2]);
      if (Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
        setResults([]);
        setSearchErr(null);
        onPickRef.current(la, ln); // marker + view via effect [lat,lng]
        return;
      }
    }
    if (query.length < 3) { setResults([]); setSearchErr(null); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=id`,
          { headers: { "Accept-Language": "id" } }
        );
        const data = (await res.json()) as NominatimResult[];
        if (cancelled) return;
        setResults(data);
        setSearchErr(data.length === 0 ? "Tidak ada hasil — coba kata kunci lain." : null);
      } catch {
        if (!cancelled) setSearchErr("Gagal mencari — cek koneksi.");
      }
      if (!cancelled) setSearching(false);
    }, 700);
    return () => { cancelled = true; clearTimeout(t); setSearching(false); };
  }, [q]);

  function pickResult(r: NominatimResult) {
    const la = parseFloat(r.lat);
    const ln = parseFloat(r.lon);
    setResults([]);
    setQ("");
    onPickRef.current(la, ln); // marker + view via effect [lat,lng]
  }

  return (
    <div>
      <div className="mb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari lokasi… (cth: Madiun / nama jalan toko)"
          className="input"
        />
        {searching && <p className="mt-1 text-xs text-gray-600">Mencari…</p>}
        {searchErr && <p className="mt-1 text-xs text-warning">{searchErr}</p>}
        {results.length > 0 && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-2xl border border-black/10 bg-white">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => pickResult(r)}
                className="block w-full border-b border-black/5 px-3 py-2 text-left text-xs text-ink last:border-0 hover:bg-beige/60"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={divRef}
        className="h-72 w-full overflow-hidden rounded-2xl border border-black/10"
        aria-label="Peta pilih lokasi toko — cari atau klik untuk menandai titik"
      />
    </div>
  );
}
