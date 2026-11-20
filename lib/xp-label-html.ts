// lib/xp-label-html.ts — lembar label XP-D4601B sebagai HTML untuk DIALOG CETAK Android (2026-11-20).
// Di tablet kasir RawBT diatur mencetak NOTA otomatis ke printer default (RPP02N), jadi job label tidak
// boleh lewat intent `rawbt:` lagi (akan keluar di printer nota). Label dicetak lewat layanan cetak
// RawBT: Chrome → dialog cetak → printer "XP-D4601B_5419" (driver tspl_general, 864 dot = 108 mm).
// Satu halaman = satu baris liner (3 label × 33×15 mm, gap 3 mm) agar tiap halaman jatuh pas di
// satu baris label. Geometri sama dengan job TSPL (lib/tspl.ts). Murni agar teruji.

import { XP_COLS, XP_LABEL_H_MM, XP_LABEL_W_MM, XP_ORIGIN_MM, XP_PITCH_MM } from "@/lib/tspl";

export const XP_SHEET_W_MM = 108;

export interface XpHtmlLabel {
  barcode: string;
  name: string;
  size?: string;
  price: number;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** label → baris (maks XP_COLS per baris) */
export function chunkRows<T>(labels: T[], cols = XP_COLS): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < labels.length; i += cols) rows.push(labels.slice(i, i + cols));
  return rows;
}

/**
 * HTML lengkap; `barcodeImg(code)` mengembalikan data-URL gambar barcode (di browser: JsBarcode → canvas).
 * Teks tebal satu ketebalan (Arial bold) — permintaan toko: tulisan label lebih jelas.
 */
export function buildXpLabelSheetHtml(labels: XpHtmlLabel[], barcodeImg: (code: string) => string): string {
  const rows = chunkRows(labels);
  const pages = rows
    .map(
      (row) => `<section class="row">${row
        .map((l, col) => {
          const left = XP_ORIGIN_MM + col * XP_PITCH_MM;
          const title = `${l.name}${l.size ? ` ${l.size}` : ""}`;
          return `<div class="lbl" style="left:${left.toFixed(2)}mm">
  <img class="bc" src="${barcodeImg(l.barcode)}" alt="">
  <div class="code">${esc(l.barcode)}</div>
  <div class="name">${esc(title)}</div>
  <div class="price">Rp ${l.price.toLocaleString("id-ID")}</div>
</div>`;
        })
        .join("")}</section>`
    )
    .join("");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Label ${labels.length}</title>
<style>
  @page { size: ${XP_SHEET_W_MM}mm ${XP_LABEL_H_MM}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${XP_SHEET_W_MM}mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .row { position: relative; width: ${XP_SHEET_W_MM}mm; height: ${XP_LABEL_H_MM}mm; overflow: hidden; page-break-after: always; break-after: page; }
  .row:last-child { page-break-after: auto; break-after: auto; }
  .lbl { position: absolute; top: 0; width: ${XP_LABEL_W_MM}mm; height: ${XP_LABEL_H_MM}mm; padding: 0.6mm 1mm 0; text-align: center; overflow: hidden; }
  .bc { display: block; width: 30mm; height: 7mm; margin: 0 auto; image-rendering: pixelated; }
  .code { font-size: 5.5pt; font-weight: bold; line-height: 1.1; letter-spacing: 0.2px; }
  .name { font-size: 6.5pt; font-weight: bold; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .price { font-size: 7.5pt; font-weight: bold; line-height: 1.15; }
</style>
</head>
<body>${pages}</body>
</html>`;
}
