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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "barcode-scanner-region";

  useEffect(() => {
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          scanner
            .stop()
            .then(() => setActive(false))
            .catch(() => {});
          onScan(decodedText);
        },
        () => {}
      )
      .then(() => setActive(true))
      .catch((e: any) => setError(e?.message || "Kamera tidak dapat diakses"));

    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div className="rounded-2xl bg-danger/10 p-4 text-center text-sm text-danger">
            {error}
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
          </>
        )}
      </div>
    </div>
  );
}
