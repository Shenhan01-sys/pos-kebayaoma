"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Icon } from "@/components/icons";

export default function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "barcode-scanner-region";

  useEffect(() => {
    let mounted = true;

    const initScanner = async () => {
      try {
        const el = document.getElementById(regionId);
        if (!el) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            scanner
              .stop()
              .then(() => mounted && setActive(false))
              .catch(() => {});
            onScan(decodedText);
          },
          () => {}
        );

        if (mounted) setActive(true);
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Kamera tidak dapat diakses");
        }
      }
    };

    initScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual() {
    const code = manual.trim();
    if (!code) return;
    onScan(code);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-[380px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">Scan Barcode</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600"
            aria-label="Tutup"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {error ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-danger/10 p-4 text-center text-sm text-danger">
              {error}
            </div>
            <div className="border-t border-black/5 pt-3">
              <label className="mb-1 block text-xs text-olive">
                Input manual barcode / SKU
              </label>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                  placeholder="mis. ANTING-ANTING"
                  className="input flex-1"
                  autoFocus
                />
                <button
                  onClick={submitManual}
                  disabled={!manual.trim()}
                  className="btn-primary px-4 disabled:opacity-40"
                >
                  Cari
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              id={regionId}
              className="overflow-hidden rounded-2xl bg-black"
              style={{ minHeight: 240 }}
            />
            {!active && (
              <p className="mt-2 text-center text-xs text-gray-500">
                Mengaktifkan kamera…
              </p>
            )}
            {active && (
              <p className="mt-2 text-center text-xs text-gray-500">
                Arahkan kamera ke barcode
              </p>
            )}
            <div className="mt-3 border-t border-black/5 pt-3">
              <label className="mb-1 block text-xs text-olive">
                Input manual (opsional)
              </label>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                  placeholder="mis. ANTING-ANTING"
                  className="input flex-1"
                />
                <button
                  onClick={submitManual}
                  disabled={!manual.trim()}
                  className="btn-soft px-4 disabled:opacity-40"
                >
                  Cari
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
