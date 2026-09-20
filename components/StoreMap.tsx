"use client";

// E9: peta pilih titik toko — Leaflet + OpenStreetMap (gratis, tanpa API key).
// Klik peta → koordinat terisi; marker ikut saat GPS tombol dipakai juga.

import { useEffect, useRef } from "react";

interface StoreMapProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}

export default function StoreMap({ lat, lng, onPick }: StoreMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // init sekali
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !divRef.current || mapRef.current) return;
      const start: [number, number] = lat != null && lng != null ? [lat, lng] : [-2.5, 118]; // Indonesia
      const map = L.map(divRef.current, { zoomControl: true }).setView(start, lat != null ? 17 : 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
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

  // sinkron saat lat/lng berubah dari luar (tombol GPS / pilih toko)
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || lat == null || lng == null) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }, [lat, lng]);

  return (
    <div
      ref={divRef}
      className="h-72 w-full overflow-hidden rounded-2xl border border-black/10"
      aria-label="Peta pilih lokasi toko — klik untuk menandai titik"
    />
  );
}
