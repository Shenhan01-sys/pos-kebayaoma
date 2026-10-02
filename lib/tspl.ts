// lib/tspl.ts — E15: job TSPL untuk label die-cut XP-420B / XP-D4601B (203 dpi = 8 dot/mm).
// 1 baris fisik (3 label, tinggi 15 mm + gap 3 mm) = 1 unit TSPL berukuran 108x15 mm.
// Jumlah baris = ceil(label / 3) → TIDAK ada feed berlebih, tanpa halaman/rotasi driver.
//
// Barcode = perintah BARCODE printer. Teks (nama, harga) = BITMAP yang digambar sendiri
// (font bawaan printer ini tidak sesuai tabel standar → lebar tidak bisa dipastikan). Dengan bitmap,
// lebar teks diketahui PERSIS → centering per objek tepat & nama panjang dipotong otomatis ("..").
//
// Geometri DIUKUR dengan penggaris cetak (2026-10-02), koordinat TSPL = posisi printer:
//   label 1: 1,0–34,0 mm · label 2: 37,0–70,0 mm · label 3: 73,5–106,0 mm (lebar 33 mm, tinggi ±14–15 mm)
//   → awal 1,0 mm, pitch kolom rata-rata 36,25 mm. Desain WAJIB di dalam 33x15 (margin aman ≥1 mm).

import JsBarcode from "jsbarcode";

export type BarcodeMode = "adaptive" | "fixed" | "native";

export interface TsplLabel {
  name: string;
  size?: string;
  price: number;
  barcode: string;
}

export interface TsplOptions {
  /** koreksi geser seluruh konten ke kanan (mm, boleh negatif) di atas XP_ORIGIN_MM */
  leftOffsetMm?: number;
  /** koreksi geser seluruh konten ke bawah (mm) */
  topOffsetMm?: number;
  /** mode barcode: adaptive = modul bulat 1–3 dot (default, scan paling andal) · fixed = lebar seragam 30 mm
   *  (modul pecahan, terbukti sulit dibaca scanner) · native = perintah BARCODE printer (modul 1 dot) */
  barcodeMode?: BarcodeMode;
}

/** hasil gambar teks: piksel ink (1 = tinta/hitam) baris demi baris */
export interface TextBitmap {
  w: number;
  h: number;
  ink: Uint8Array; // panjang w*h, nilai 0/1
}
export type TextRenderer = (text: string, px: number, bold: boolean) => TextBitmap;

export const DOTS_PER_MM = 8;
export const XP_COLS = 3;
export const XP_LABEL_W_MM = 33;
export const XP_LABEL_H_MM = 15;
export const XP_GAP_MM = 3;
/** tepi kiri label kolom 1 diukur dari titik nol printer */
export const XP_ORIGIN_MM = 1.0;
/** jarak tepi-kiri antar kolom (diukur: 36,0 dan 36,5 → rata-rata) */
export const XP_PITCH_MM = 36.25;
export const XP_LEFT_OFFSET_MM = 0;
/** naik 1 mm dari 2,5 — hasil uji cetak fisik 2026-10-02 */
export const XP_TOP_OFFSET_MM = 1.5;
/** BITMAP TSPL: bit 0 = titik hitam (tercetak), bit 1 = putih */
export const BITMAP_INK_BIT = 0;
/** default mode barcode — user: mode "fixed" (modul pecahan) tidak terbaca scanner (2026-10-02) */
export const XP_BARCODE_MODE: BarcodeMode = "adaptive";

const mm = (v: number) => Math.round(v * DOTS_PER_MM);
const CELL_W = mm(XP_LABEL_W_MM); // 264
const CELL_PITCH = mm(XP_PITCH_MM); // 290
const BARCODE_NARROW = 1; // 0,125 mm/modul — batas aman scanner @203dpi
const BARCODE_H = 40; // 5 mm
/** lebar barcode seragam (30 mm); kode > ini modul (mis. >240 modul) jatuh ke lebar alami */
export const BARCODE_FIXED_W = 240;
/** modul terbesar yang dicoba (3 dot = 0,375 mm) */
const BARCODE_MAX_SCALE = 3;
const SAFE_W = CELL_W - 2 * 12; // margin aman 1,5 mm kiri-kanan → 240 dot
const Y_BARCODE = 14;
const Y_NAME = 60;
const Y_PRICE = 76;
const NAME_PX = { max: 13, min: 10 };
const PRICE_PX = { max: 18, min: 13 };

/** hanya ASCII cetak, tanda kutip dibuang (kutip memecah string TSPL) */
export function tsplSafe(s: string): string {
  return s
    .replace(/[·•–—]/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["\\]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .trim();
}

/** estimasi jumlah modul Code128 (auto subset B/C) → lebar barcode untuk centering */
export function code128Modules(text: string): number {
  let symbols = 0;
  let i = 0;
  let inC = false;
  while (i < text.length) {
    let run = 0;
    while (i + run < text.length && /\d/.test(text[i + run])) run++;
    const wantC = run >= 4 || (run >= 2 && i === 0 && run === text.length);
    if (wantC) {
      if (!inC) { symbols++; inC = true; }
      const pairs = Math.floor(run / 2);
      symbols += pairs;
      i += pairs * 2;
    } else {
      if (inC) { symbols++; inC = false; }
      symbols++;
      i++;
    }
  }
  // start + data + check = (symbols+2)*11 modul ; stop = 13 modul
  return (symbols + 2) * 11 + 13;
}

/** perkecil font lalu potong ("..") sampai lebar ≤ maxW. `keepSuffix` selalu dipertahankan (mis. ukuran). */
export function fitText(
  render: TextRenderer,
  text: string,
  keepSuffix: string,
  maxW: number,
  px: { max: number; min: number },
  bold: boolean
): TextBitmap {
  const full = keepSuffix ? `${text} ${keepSuffix}` : text;
  for (let p = px.max; p >= px.min; p--) {
    const b = render(full, p, bold);
    if (b.w <= maxW) return b;
  }
  let t = text;
  while (t.length > 1) {
    t = t.slice(0, -1);
    const cand = `${t.trimEnd()}..${keepSuffix ? ` ${keepSuffix}` : ""}`;
    const b = render(cand, px.min, bold);
    if (b.w <= maxW) return b;
  }
  return render(keepSuffix || text.slice(0, 1), px.min, bold);
}

/** pola modul Code128 persis dari JsBarcode (string "1101..." — 1 = bar) */
export function code128Pattern(text: string): string {
  const o: { encodings?: { data: string }[] } = {};
  JsBarcode(o as unknown as object, text, { format: "CODE128" });
  return (o.encodings ?? []).map((e) => e.data).join("");
}

/** barcode digambar sendiri selebar targetW dot. Tepi tiap modul dibulatkan KUMULATIF
 *  (round(i*targetW/modul)) → galat posisi tepi ≤ 0,5 dot, tidak menumpuk. null jika modul > targetW. */
export function code128Bitmap(text: string, targetW: number, h: number): TextBitmap | null {
  let bits: string;
  try { bits = code128Pattern(text); } catch { return null; }
  const n = bits.length;
  if (!n || n > targetW) return null;
  const row = new Uint8Array(targetW);
  for (let i = 0; i < n; i++) {
    if (bits[i] !== "1") continue;
    const a = Math.round((i * targetW) / n);
    const b = Math.round(((i + 1) * targetW) / n);
    for (let x = a; x < b; x++) row[x] = 1;
  }
  const ink = new Uint8Array(targetW * h);
  for (let r = 0; r < h; r++) ink.set(row, r * targetW);
  return { w: targetW, h, ink };
}

/** barcode dengan lebar modul BILANGAN BULAT (scale dot/modul) — tanpa distorsi rasio garis. */
export function code128BitmapScaled(text: string, scale: number, h: number): TextBitmap | null {
  let bits: string;
  try { bits = code128Pattern(text); } catch { return null; }
  if (!bits.length || scale < 1) return null;
  const w = bits.length * scale;
  const row = new Uint8Array(w);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") row.fill(1, i * scale, (i + 1) * scale);
  }
  const ink = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) ink.set(row, r * w);
  return { w, h, ink };
}

/** Modul terbesar (1–3 dot, bulat) yang muat di area aman (SAFE_W). Kode panjang: modul 1 dot selama
 *  muat di sel 33 mm; lebih panjang dari itu → null (jatuh ke BARCODE native). */
export function code128BitmapAdaptive(text: string, h: number): TextBitmap | null {
  let modules: number;
  try { modules = code128Pattern(text).length; } catch { return null; }
  if (!modules) return null;
  const scale = Math.min(BARCODE_MAX_SCALE, Math.floor(SAFE_W / modules));
  if (scale >= 1) return code128BitmapScaled(text, scale, h);
  return modules <= CELL_W ? code128BitmapScaled(text, 1, h) : null;
}

const enc = new TextEncoder();

/** BITMAP x,y,widthBytes,height,0,<data> — data biner (bit 0 = hitam), padding putih */
function bitmapCmd(x: number, y: number, b: TextBitmap): Uint8Array {
  const wb = Math.ceil(b.w / 8);
  const data = new Uint8Array(wb * b.h).fill(BITMAP_INK_BIT === 0 ? 0xff : 0x00);
  for (let r = 0; r < b.h; r++) {
    for (let c = 0; c < b.w; c++) {
      if (b.ink[r * b.w + c]) {
        const idx = r * wb + (c >> 3);
        const mask = 0x80 >> (c & 7);
        data[idx] = BITMAP_INK_BIT === 0 ? data[idx] & ~mask : data[idx] | mask;
      }
    }
  }
  const head = enc.encode(`BITMAP ${x},${y},${wb},${b.h},0,`);
  const out = new Uint8Array(head.length + data.length + 2);
  out.set(head, 0);
  out.set(data, head.length);
  out.set([0x0d, 0x0a], head.length + data.length);
  return out;
}

const center = (cellX: number, contentDots: number) =>
  cellX + Math.max(0, Math.floor((CELL_W - contentDots) / 2));

function cellParts(l: TsplLabel, cellX: number, top: number, render: TextRenderer, mode: BarcodeMode): Uint8Array[] {
  const parts: Uint8Array[] = [];
  const code = tsplSafe(l.barcode);
  const bc =
    mode === "adaptive" ? code128BitmapAdaptive(code, BARCODE_H) :
    mode === "fixed" ? code128Bitmap(code, BARCODE_FIXED_W, BARCODE_H) :
    null;
  if (bc) {
    parts.push(bitmapCmd(center(cellX, bc.w), top + Y_BARCODE, bc));
  } else {
    // native: dipakai mode "native" atau kode terlalu panjang untuk bitmap (modul > lebar sel)
    const bcW = code128Modules(code) * BARCODE_NARROW;
    parts.push(enc.encode(`BARCODE ${center(cellX, bcW)},${top + Y_BARCODE},"128",${BARCODE_H},0,0,${BARCODE_NARROW},${BARCODE_NARROW},"${code}"\r\n`));
  }

  // masing-masing objek di-center sendiri terhadap sel 33 mm (bukan satu grup)
  const name = fitText(render, tsplSafe(l.name), l.size ? tsplSafe(l.size) : "", SAFE_W, NAME_PX, false);
  parts.push(bitmapCmd(center(cellX, name.w), top + Y_NAME, name));

  const price = fitText(render, `Rp ${l.price.toLocaleString("id-ID")}`, "", SAFE_W, PRICE_PX, true);
  parts.push(bitmapCmd(center(cellX, price.w), top + Y_PRICE, price));
  return parts;
}

/** job TSPL lengkap (byte) — kirim apa adanya ke printer (RAW) */
export function buildTsplJob(labels: TsplLabel[], render: TextRenderer, opts: TsplOptions = {}): Uint8Array {
  const left = mm(XP_ORIGIN_MM + (opts.leftOffsetMm ?? XP_LEFT_OFFSET_MM));
  const top = mm(opts.topOffsetMm ?? XP_TOP_OFFSET_MM);
  const rows = Math.ceil(labels.length / XP_COLS);
  const parts: Uint8Array[] = [
    enc.encode(`SIZE 108 mm,${XP_LABEL_H_MM} mm\r\nGAP ${XP_GAP_MM} mm,0 mm\r\nDIRECTION 1\r\n`),
  ];
  for (let r = 0; r < rows; r++) {
    parts.push(enc.encode("CLS\r\n"));
    for (let c = 0; c < XP_COLS; c++) {
      const l = labels[r * XP_COLS + c];
      if (!l) break;
      parts.push(...cellParts(l, left + c * CELL_PITCH, top, render, opts.barcodeMode ?? XP_BARCODE_MODE));
    }
    parts.push(enc.encode("PRINT 1,1\r\n"));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
