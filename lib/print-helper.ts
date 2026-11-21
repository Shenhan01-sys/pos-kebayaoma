// lib/print-helper.ts — app pembantu Android "Kebaya Oma Print" (folder android-print/, 2026-11-21).
// Masalah: dari web, RawBT SELALU mencetak ke printer default-nya (X2.c.e() → PRINTER_CURRENT, dibuktikan
// dari APK 7.1.2), jadi nota (RPP02N) dan label (XP-D4601B) berebut satu default. App pembantu menerima
// target per kiriman dan mengirim byte LANGSUNG lewat Bluetooth SPP ke printer yang benar — tanpa RawBT,
// tanpa popup & tanpa watermark versi gratis. Aktif per perangkat lewat setelan `printHelper`.

export const HELPER_PACKAGE = "id.kebayaoma.print";
export const HELPER_SCHEME = "kopos-print";

export type HelperTarget = "nota" | "label";

/**
 * URL intent Chrome Android → app pembantu: data = `kopos-print:<target>;base64,<job>`
 * (format sama dengan RawBT `rawbt:base64,…`, yang terbukti jalan untuk job label besar).
 */
export function helperIntentUrl(target: HelperTarget, jobBase64: string): string {
  return `intent:${target};base64,${jobBase64}#Intent;scheme=${HELPER_SCHEME};package=${HELPER_PACKAGE};end;`;
}

/** URL untuk membuka layar setelan app pembantu (pilih printer, tes) */
export const HELPER_SETTINGS_URL = `intent:settings#Intent;scheme=${HELPER_SCHEME};package=${HELPER_PACKAGE};end;`;
