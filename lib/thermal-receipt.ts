// lib/thermal-receipt.ts — HTML struk thermal untuk printer portable Rongta.
// Kertas 80mm (area cetak ~72mm). Dipakai via printHtmlViaIframe() — @page
// `80mm auto` membuat dialog print berhenti di akhir konten (bukan A4 nonstop).
// Revisi 2 (2026-09-18, temuan uji fisik user): (a) QR dikirim sebagai PNG
// bitmap (bukan SVG) — sebagian driver thermal mencetak vektor SVG sebagai
// karakter acak; (b) margin pindah ke body padding +1cm atas/bawah (request
// user) karena @page margin ditimpa setting dialog Chrome.

import { formatRupiah, type Transaction } from "@/lib/dummy";

interface ReceiptStoreInfo {
  storeName: string;
  address: string;
  phone: string;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Garis pemisah teks murni — <hr> ber-CSS border-top dirender sebagian driver
// thermal sebagai karakter acak (temuan uji fisik: 2 baris sampah sebelum subtotal).
const DASH = "-".repeat(42);

export function buildThermalReceiptHtml(
  tx: Transaction,
  s: ReceiptStoreInfo,
  qrPng?: string
): string {
  const items = tx.items
    .map(
      (it) => `
      <tr>
        <td colspan="2" class="name">${esc(it.name)}${it.unitPrice === 0 ? " <b>GRATIS</b>" : ""}</td>
      </tr>
      <tr>
        <td class="dim">${esc(it.size)} / ${esc(it.color)} x${it.quantity}</td>
        <td class="r">${formatRupiah(it.total)}</td>
      </tr>`
    )
    .join("");

  const rows: [string, string][] = [["Subtotal", formatRupiah(tx.subtotal)]];
  if (tx.discount > 0) rows.push(["Diskon", "-" + formatRupiah(tx.discount)]);
  const payRows: [string, string][] = [
    [`Bayar (${tx.paymentMethod.toUpperCase()})`, formatRupiah(tx.amountPaid)],
  ];
  if (tx.change > 0) payRows.push(["Kembali", formatRupiah(tx.change)]);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(tx.number)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 80mm; padding: 10mm 3mm; font-family: "Courier New", monospace; font-size: 13px; line-height: 1.45; color: #000; text-align: center; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  td { vertical-align: top; padding: 0; }
  .c { text-align: center; }
  .r { text-align: right; white-space: nowrap; }
  .b { font-weight: bold; }
  .dim { color: #444; font-size: 11.5px; }
  .name { font-weight: bold; font-size: 13.5px; }
  .dash { white-space: pre; overflow: hidden; letter-spacing: 0; margin: 5px 0; }
  .store { font-size: 17px; font-weight: bold; letter-spacing: 0.5px; }
  .meta { font-size: 12px; }
  .total { font-size: 17px; font-weight: bold; }
  .qr { width: 34mm; height: 34mm; margin: 5px auto 2px; display: block; }
  .small { font-size: 11.5px; color: #444; }
</style>
</head>
<body>
  <div class="c b store">${esc(s.storeName.toUpperCase())}</div>
  <div class="c small">${esc(s.address)}</div>
  <div class="c small">Telp: ${esc(s.phone)}</div>
  <div class="dash">${DASH}</div>
  <table class="meta">
    <tr><td>${esc(tx.number)}</td><td class="r">${new Date(tx.createdAt).toLocaleString("id-ID")}</td></tr>
    <tr><td colspan="2">Kasir: ${esc(tx.cashier)}${tx.customerName ? " / Pelanggan: " + esc(tx.customerName) : ""}</td></tr>
  </table>
  <div class="dash">${DASH}</div>
  <table>${items}</table>
  <div class="dash">${DASH}</div>
  <table>
    ${rows.map(([k, v]) => `<tr><td>${k}</td><td class="r">${v}</td></tr>`).join("")}
    ${tx.tax > 0 ? `<tr><td colspan="2" class="small">Sudah termasuk PPN ${formatRupiah(tx.tax)}</td></tr>` : ""}
    <tr><td colspan="2"><div class="dash" style="margin:2px 0">${"-".repeat(24)}</div></td></tr>
    <tr><td class="total">TOTAL</td><td class="r total">${formatRupiah(tx.total)}</td></tr>
    ${payRows.map(([k, v]) => `<tr><td>${k}</td><td class="r">${v}</td></tr>`).join("")}
  </table>
  <div class="dash">${DASH}</div>
  ${qrPng ? `<div class="c"><img class="qr" src="${qrPng}" alt="QR"></div><div class="c small">Scan untuk verifikasi resmi</div>` : ""}
  <div class="c b" style="margin-top:4px">Terima kasih</div>
  <div class="c small">Barang tidak bisa dikembalikan</div>
</body>
</html>`;
}
