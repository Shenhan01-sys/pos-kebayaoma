// lib/rawbt.ts — E27: cetak label XP-D4601B dari tablet Android lewat app RawBT (Bluetooth).
// Job TSPL = byte yang sama dengan jalur print-bridge PC (buildTsplJob, geometri E15); RawBT hanya
// meneruskan byte apa adanya (RAW) ke printer DEFAULT RawBT — XP-D4601B harus jadi default di RawBT.

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
