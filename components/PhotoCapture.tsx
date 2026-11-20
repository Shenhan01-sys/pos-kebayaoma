"use client";

// components/PhotoCapture.tsx — kamera DI DALAM halaman untuk foto bukti bayar (keluhan staf 2026-11-20 no. 1–2).
// <input capture> membuka app kamera Android → PWA ke belakang → di tablet kasir prosesnya sering dimatikan
// Android lalu termuat ulang (keranjang hilang), dan membuka/menutup app kamera itu lambat. Di sini kamera
// tetap di halaman (getUserMedia, izin sama dengan scanner barcode). Gagal/izin ditolak → `onFallback`
// (kembali ke kamera HP lewat <input capture>).

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.7;

export default function PhotoCapture({
  onCapture,
  onClose,
  onFallback,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-gum");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) return;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setErr("Kamera tidak bisa dibuka di halaman ini.");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.max(1, Math.round(v.videoWidth * scale));
    const h = Math.max(1, Math.round(v.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(v, 0, 0, w, h);
    onCapture(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
        {!ready && !err && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Membuka kamera…</div>
        )}
        {err && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white">
            <span>{err}</span>
            <button onClick={onFallback} className="btn-primary px-5 py-2">
              Pakai kamera HP
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 p-4 pb-6">
        <button onClick={onClose} className="rounded-full bg-white/15 px-5 py-3 text-sm font-semibold text-white">
          Batal
        </button>
        <button
          onClick={snap}
          disabled={!ready}
          aria-label="Ambil foto"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/30 disabled:opacity-40"
        >
          <Icon name="camera" size={26} className="text-white" />
        </button>
        <button onClick={onFallback} className="rounded-full bg-white/15 px-4 py-3 text-xs font-semibold text-white">
          Galeri / kamera HP
        </button>
      </div>
    </div>
  );
}
