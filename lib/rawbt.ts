// lib/rawbt.ts — E27: cetak label XP-D4601B dari tablet Android lewat app RawBT (Bluetooth).
// Job TSPL = byte yang sama dengan jalur print-bridge PC (buildTsplJob, geometri E15); RawBT hanya
// meneruskan byte apa adanya ke printer DEFAULT RawBT — profil XP-D4601B harus driver "raw transfer"
// (driver "tspl_general" mencetak job sebagai TEKS, terbukti 2026-10-15) dan jadi default di RawBT.

export const RAWBT_PACKAGE = "ru.a402d.rawbtprinter";

/** batas baris per sekali kirim — URL intent besar (> ±1 MB) gagal lewat Binder Android */
export const RAWBT_MAX_ROWS = 10;

/**
 * Print-bridge hanya bisa jalan di Windows (spooler RAW via rawprint.ps1).
 * Selain Windows + layar sentuh (tablet Android, termasuk mode "situs desktop" Chrome
 * yang menyamarkan UA jadi Linux) → kirim lewat RawBT.
 */
export function shouldUseRawbt(userAgent: string, maxTouchPoints: number): boolean {
  if (/Windows/i.test(userAgent)) return false;
  return /Android/i.test(userAgent) || maxTouchPoints > 0;
}

/** URL intent Chrome Android → RawBT (`rawbt:base64,<job>`), paket dikunci ke RawBT */
export function rawbtIntentUrl(jobBase64: string): string {
  return `intent:base64,${jobBase64}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`;
}

// ===== E29: panel "Siapkan printer label" — web tidak bisa membaca status RawBT/Bluetooth =====
// (intent satu arah) → status dibuktikan: (1) halaman POS tersembunyi = app RawBT terbuka,
// (2) printer berbunyi bip = RawBT benar-benar tersambung ke XP-D4601B (dikonfirmasi user).

/**
 * Buka layar utama RawBT. Chrome menambah kategori BROWSABLE ke semua intent dari web, jadi
 * action MAIN/LAUNCHER ditolak (jatuh ke Play Store, uji 2026-10-16); skema `app402d` milik
 * MainActivity RawBT menerima BROWSABLE.
 */
export const RAWBT_LAUNCH_URL = `intent://${RAWBT_PACKAGE}#Intent;scheme=app402d;package=${RAWBT_PACKAGE};end`;

/** TSPL SOUND: printer berbunyi tanpa memajukan kertas (uji fisik XP-D4601B 2026-10-16) */
export const RAWBT_BEEP_JOB = "SOUND 5,300\r\n";

/** status "siap" berlaku selama ini sejak dicek — printer bisa dimatikan setelahnya */
export const RAWBT_READY_TTL_MS = 30 * 60 * 1000;

export interface RawbtReadyState {
  /** waktu (ms) RawBT terbukti terbuka */
  appAt?: number;
  /** waktu (ms) user mengonfirmasi printer berbunyi bip */
  printerAt?: number;
}

export interface RawbtReadiness {
  app: boolean;
  printer: boolean;
  ready: boolean;
  /** sisa waktu status siap (ms), 0 bila belum siap */
  remainingMs: number;
}

/** printer hanya dianggap tersambung bila RawBT juga terbuka; keduanya kedaluwarsa setelah TTL */
export function rawbtReadiness(s: RawbtReadyState, now: number): RawbtReadiness {
  const fresh = (t?: number) => t !== undefined && now >= t && now - t < RAWBT_READY_TTL_MS;
  const app = fresh(s.appAt);
  const printer = app && fresh(s.printerAt);
  const ready = app && printer;
  const remainingMs = ready ? RAWBT_READY_TTL_MS - (now - Math.min(s.appAt!, s.printerAt!)) : 0;
  return { app, printer, ready, remainingMs };
}
