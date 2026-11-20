// lib/escpos-receipt.ts — nota ESC/POS teks untuk printer nota Rongta RPP02N (58mm, 384 dot, Font A = 32 kolom).
// Dikirim lewat RawBT (`rawbt:base64,…`) sehingga tercetak langsung tanpa dialog cetak Android
// (revisi toko 16–18 Nov 2026: "printer direct, habis transaksi langsung print").
// RawBT dari browser selalu mencetak ke printer DEFAULT-nya → di tablet kasir default = RPP02N;
// isi sama dengan buildThermalReceiptHtml (lib/thermal-receipt.ts). Murni agar teruji.

import { formatRupiah, type Transaction } from "@/lib/dummy";
import { receiptRentalInfo } from "@/lib/rental";
import { joinInfo } from "@/lib/label-text";

export const ESCPOS_COLS = 32;

export interface EscposReceiptStore {
  storeName: string;
  address: string;
  phone: string;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** teks → ASCII aman untuk code page bawaan printer (PC437): tanda baca unicode diganti, sisanya dibuang */
export function toAscii(v: unknown): string {
  return String(v ?? "")
    .replace(/[  ]/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e\n]/g, "");
}

/** pecah teks per kata ke baris selebar `width` (kata terlalu panjang dipotong) */
export function wrap(text: string, width = ESCPOS_COLS): string[] {
  const out: string[] = [];
  for (const para of toAscii(text).split("\n")) {
    let line = "";
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > width) {
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += " " + word;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

/** kiri–kanan dalam satu baris; bila tak muat, kiri dibungkus dan kanan rata kanan di baris terakhir/baru */
export function leftRight(left: string, right: string, width = ESCPOS_COLS): string[] {
  const r = toAscii(right);
  const lines = wrap(left, width);
  const last = lines[lines.length - 1] ?? "";
  if (last.length + 1 + r.length <= width) {
    lines[lines.length - 1] = last + " ".repeat(width - last.length - r.length) + r;
    return lines;
  }
  return [...lines, " ".repeat(Math.max(0, width - r.length)) + r];
}

class Bytes {
  b: number[] = [];
  raw(...n: number[]) { this.b.push(...n); return this; }
  text(s: string) { for (const ch of toAscii(s)) this.b.push(ch.charCodeAt(0)); return this; }
  line(s = "") { return this.text(s).raw(LF); }
  lines(ls: string[]) { ls.forEach((l) => this.line(l)); return this; }
  align(a: "left" | "center" | "right") { return this.raw(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2); }
  bold(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  /** GS ! — 0x00 normal, 0x11 lebar+tinggi ganda */
  size(n: number) { return this.raw(GS, 0x21, n); }
  dash() { return this.line("-".repeat(ESCPOS_COLS)); }
  /** QR native ESC/POS (GS ( k, model 2, ECC M) */
  qr(data: string, moduleSize = 5) {
    const d = toAscii(data);
    const len = d.length + 3;
    this.raw(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00);
    this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, moduleSize);
    this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31);
    this.raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30).text(d);
    return this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30);
  }
}

export interface EscposReceiptOptions {
  renterPhone?: string | null;
  /** URL verifikasi untuk QR; kosong = tanpa QR */
  verifyUrl?: string;
}

/** byte ESC/POS lengkap untuk satu nota */
export function buildEscposReceipt(tx: Transaction, s: EscposReceiptStore, opt: EscposReceiptOptions = {}): Uint8Array {
  const rental = receiptRentalInfo(tx, { phone: opt.renterPhone });
  const p = new Bytes();
  p.raw(ESC, 0x40); // init
  p.align("center").bold(true).size(0x11);
  wrap(s.storeName.toUpperCase(), ESCPOS_COLS / 2).forEach((l) => p.line(l));
  p.size(0x00).bold(false);
  if (s.address) p.lines(wrap(s.address));
  if (s.phone) p.lines(wrap(`Telp: ${s.phone}`));
  p.align("left").dash();
  p.line(toAscii(tx.number));
  p.line(toAscii(new Date(tx.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })));
  if (rental) p.align("center").bold(true).line(rental.label).bold(false).align("left");
  p.lines(wrap(`Kasir: ${tx.cashier}`));
  if (tx.customerName) p.lines(wrap(`${rental ? "Penyewa" : "Pelanggan"}: ${tx.customerName}`));
  if (rental?.phone) p.lines(wrap(`Telp penyewa: ${rental.phone}`));
  if (rental?.returnLabel) p.bold(true).lines(wrap(`Kembali: ${rental.returnLabel}`)).bold(false);
  p.dash();
  for (const it of tx.items) {
    p.bold(true).lines(wrap(`${it.name}${it.unitPrice === 0 ? " GRATIS" : ""}`)).bold(false);
    const info = joinInfo([it.size, it.color]);
    p.lines(leftRight(`${info ? info + " " : ""}x${it.quantity}`, formatRupiah(it.total)));
  }
  p.dash();
  p.lines(leftRight("Subtotal", formatRupiah(tx.subtotal)));
  if (tx.discount > 0) p.lines(leftRight("Diskon", "-" + formatRupiah(tx.discount)));
  if (tx.tax > 0) p.lines(wrap(`Sudah termasuk PPN ${formatRupiah(tx.tax)}`));
  p.bold(true).lines(leftRight("TOTAL", formatRupiah(tx.total))).bold(false);
  p.lines(leftRight(`Bayar (${tx.paymentMethod.toUpperCase()})`, formatRupiah(tx.amountPaid)));
  if (tx.change > 0) p.lines(leftRight("Kembali", formatRupiah(tx.change)));
  p.dash().align("center");
  if (opt.verifyUrl) p.qr(opt.verifyUrl).raw(LF).line("Scan untuk verifikasi resmi");
  p.bold(true).line("Terima kasih").bold(false);
  p.lines(wrap(rental ? rental.footer : "Barang tidak bisa dikembalikan"));
  p.align("left").raw(LF, LF, LF);
  return Uint8Array.from(p.b);
}

/** base64 dari byte mentah (browser: btoa; Node/test: Buffer) */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  return Buffer.from(bytes).toString("base64");
}
