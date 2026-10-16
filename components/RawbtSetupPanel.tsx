"use client";

// E29: panel "Siapkan printer label" (tablet Android → RawBT → XP-D4601B).
// Web tidak bisa membaca status RawBT/Bluetooth (intent satu arah), jadi tiap langkah dibuktikan:
// (1) Buka RawBT — halaman POS tersembunyi = app RawBT benar-benar terbuka (deteksi otomatis);
// (2) Hubungkan ke XP — printer dikirim perintah bunyi (tanpa kertas), user konfirmasi bunyi bip.
// Tombol cetak baru aktif bila keduanya ✓. Status disimpan di sessionStorage selama RAWBT_READY_TTL_MS.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RAWBT_BEEP_JOB,
  RAWBT_LAUNCH_URL,
  RAWBT_READY_TTL_MS,
  rawbtIntentUrl,
  rawbtReadiness,
  type RawbtReadyState,
} from "@/lib/rawbt";

const STORE_KEY = "pos.rawbt.ready";
/** RawBT dianggap gagal terbuka bila halaman POS tidak tersembunyi dalam waktu ini */
const LAUNCH_TIMEOUT_MS = 3000;

function loadState(): RawbtReadyState {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as RawbtReadyState) : {};
  } catch {
    return {};
  }
}

function saveState(s: RawbtReadyState) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* mode privat / storage diblokir — status hanya hidup selama panel terbuka */
  }
}

type AppStep = "idle" | "opening" | "failed";
type PrinterStep = "idle" | "asking" | "failed";

interface Props {
  labelCount: number;
  rows: number;
  onPrint: () => void;
  onPrintCalibration: () => void;
  onClose: () => void;
}

function Toggle({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed ${
        on ? "bg-[#775533]" : "bg-gray-300"
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function RawbtSetupPanel({ labelCount, rows, onPrint, onPrintCalibration, onClose }: Props) {
  const [state, setState] = useState<RawbtReadyState>({});
  const [now, setNow] = useState(() => Date.now());
  const [appStep, setAppStep] = useState<AppStep>("idle");
  const [printerStep, setPrinterStep] = useState<PrinterStep>("idle");
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState(loadState());
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const update = useCallback((s: RawbtReadyState) => {
    setState(s);
    saveState(s);
    setNow(Date.now());
  }, []);

  const { app, printer, ready, remainingMs } = rawbtReadiness(state, now);

  // Langkah 1: buka RawBT; bukti = halaman POS tersembunyi (app lain di depan)
  const openRawbt = () => {
    setAppStep("opening");
    setPrinterStep("idle");
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      document.removeEventListener("visibilitychange", onHidden);
      if (launchTimer.current) clearTimeout(launchTimer.current);
      update({ appAt: Date.now() });
      setAppStep("idle");
    };
    document.addEventListener("visibilitychange", onHidden);
    launchTimer.current = setTimeout(() => {
      document.removeEventListener("visibilitychange", onHidden);
      setAppStep("failed");
    }, LAUNCH_TIMEOUT_MS);
    window.location.href = RAWBT_LAUNCH_URL;
  };

  // Langkah 2: perintah bunyi ke printer lewat RawBT (tanpa kertas) → user konfirmasi
  const beepPrinter = () => {
    setPrinterStep("asking");
    window.location.href = rawbtIntentUrl(btoa(RAWBT_BEEP_JOB));
  };

  useEffect(() => () => { if (launchTimer.current) clearTimeout(launchTimer.current); }, []);

  const minutesLeft = Math.max(1, Math.ceil(remainingMs / 60000));

  return (
    <div ref={panelRef} className="mb-6 p-4 border-2 border-[#775533] rounded-xl bg-[#775533]/5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#3a1430]">Siapkan printer label (tablet · RawBT)</h3>
          <p className="text-xs text-gray-600">Cetak baru bisa setelah dua langkah di bawah ✓.</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1">
          Tutup
        </button>
      </div>

      {/* Langkah 1 */}
      <div className="flex items-center gap-3 py-2">
        <Toggle
          label="Buka app RawBT"
          on={app}
          disabled={appStep === "opening"}
          onChange={(v) => (v ? openRawbt() : (update({}), setAppStep("idle"), setPrinterStep("idle")))}
        />
        <div className="flex-1 text-sm">
          <div className="font-medium">1. Buka app RawBT</div>
          <div className="text-xs text-gray-600">
            {app && "✓ RawBT terbuka."}
            {!app && appStep === "idle" && "RawBT akan terbuka (bisa muncul halaman Lisensi → tekan Kembali) lalu kembali ke POS."}
            {appStep === "opening" && "Membuka RawBT…"}
            {appStep === "failed" && (
              <span className="text-red-600">RawBT tidak terbuka. Pastikan app RawBT terpasang, lalu coba lagi.</span>
            )}
          </div>
        </div>
      </div>

      {/* Langkah 2 */}
      <div className="flex items-start gap-3 py-2 border-t border-[#775533]/20">
        <Toggle
          label="Hubungkan RawBT ke printer XP-D4601B"
          on={printer}
          disabled={!app}
          onChange={(v) => (v ? beepPrinter() : (update({ appAt: state.appAt }), setPrinterStep("idle")))}
        />
        <div className="flex-1 text-sm">
          <div className="font-medium">2. Hubungkan ke printer XP-D4601B</div>
          <div className="text-xs text-gray-600">
            {!app && "Selesaikan langkah 1 dulu."}
            {app && printer && "✓ Printer tersambung (bunyi bip dikonfirmasi)."}
            {app && !printer && printerStep === "idle" && "Printer akan berbunyi bip (tanpa mengeluarkan label)."}
          </div>
          {app && !printer && printerStep === "asking" && (
            <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200">
              <div className="text-xs font-medium mb-2">Printer berbunyi bip?</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { update({ ...state, printerAt: Date.now() }); setPrinterStep("idle"); }}
                  className="px-3 py-1.5 bg-[#775533] text-white rounded-lg text-xs font-bold"
                >
                  Ya, bunyi
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterStep("failed")}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-bold"
                >
                  Tidak bunyi
                </button>
                <button type="button" onClick={beepPrinter} className="px-3 py-1.5 text-xs text-[#775533] underline">
                  Bunyikan lagi
                </button>
              </div>
            </div>
          )}
          {app && !printer && printerStep === "failed" && (
            <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700 space-y-1">
              <div className="font-bold">Printer belum tersambung. Cek:</div>
              <div>• Printer XP-D4601B menyala & ada di dekat tablet.</div>
              <div>• Bluetooth tablet hidup; printer tidak sedang tersambung ke HP/PC lain.</div>
              <div>• Di RawBT: printer default = <b>XP-D4601B_RAW</b> (driver <b>raw transfer</b>).</div>
              <div>• Bila RawBT menampilkan &quot;menghubungkan kesalahan&quot;: matikan-nyalakan printer.</div>
              <button type="button" onClick={beepPrinter} className="mt-1 px-3 py-1.5 bg-white border border-red-200 rounded-lg font-bold">
                Coba bunyikan lagi
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status + aksi */}
      <div className="pt-3 border-t border-[#775533]/20">
        <div className={`text-xs mb-3 ${ready ? "text-green-700" : "text-gray-600"}`}>
          {ready
            ? `✓ Siap cetak — status berlaku ±${minutesLeft} menit lagi (${RAWBT_READY_TTL_MS / 60000} menit sejak dicek).`
            : "Belum siap — cetak dikunci sampai langkah 1 & 2 ✓."}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPrint}
            disabled={!ready || labelCount === 0}
            className="px-4 py-2 bg-[#775533] text-white rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cetak {labelCount} label ({rows} baris)
          </button>
          <button
            type="button"
            onClick={onPrintCalibration}
            disabled={!ready}
            title="1 baris: kotak area isi + garis tengah — cek posisi setelah ganti roll"
            className="px-4 py-2 bg-white border-2 border-[#775533] text-[#775533] rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cetak 1 baris kalibrasi
          </button>
        </div>
      </div>
    </div>
  );
}
