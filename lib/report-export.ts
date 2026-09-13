// lib/report-export.ts — E3: export PDF (A4 potret: Summary + Detail lampiran harga acuan)
// & XLSX (Summary + Detail, angka number riil). Nama file: laporan-<SCOPE>-<dari>..<sampai>.<ext>
// dynamic import SSR-off (pola FE1) agar bundle halaman tetap ramping.

import type { Report } from "./report-data";

export const PALETTE = {
  violet: "#290024",
  apricot: "#D4954D",
  olive: "#775533",
  custard: "#E3DEA4",
  success: "#2f9e57",
  danger: "#c0392b",
  ink: "#3a1430",
  gray: "#6b7280",
};

export interface ExportMeta {
  storeLabel: string; // MJL / KTB / SEMUA
  from: string;
  to: string;
  storeName?: string;
}

const nf = new Intl.NumberFormat("id-ID");
export const rupiah = (n: number) => `Rp ${nf.format(Math.round(n))}`;

function fileBase(m: ExportMeta) {
  const d = m.from || "all";
  const s = m.to || new Date().toISOString().slice(0, 10);
  return `laporan-${m.storeLabel}-${d}..${s}`;
}

/** Render node (mis. chart ECharts hasil html2canvas) → gambar PNG base64 utk PDF. */
async function snap(el: HTMLElement, scale = 2): Promise<string> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, { scale, backgroundColor: "#ffffff", logging: false });
  return canvas.toDataURL("image/png");
}

export interface PdfOptions {
  report: Report;
  meta: ExportMeta;
  /** elemen chart yang sudah dirender (metode & harian & produk) — opsional */
  chartNodes?: { method?: HTMLElement; daily?: HTMLElement; products?: HTMLElement };
}

export async function exportPdf({ report, meta, chartNodes }: PdfOptions): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  let y = 18;

  // ---- Header ----
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(PALETTE.violet);
  doc.text(reportTitle(meta), M, y); y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(PALETTE.gray);
  doc.text(`Periode: ${meta.from || "semua"} s.d. ${meta.to || new Date().toISOString().slice(0, 10)} · Outlet: ${meta.storeLabel}`, M, y);
  y += 2;
  doc.setDrawColor(PALETTE.apricot).setLineWidth(0.6);
  doc.line(M, y, W - M, y); y += 8;

  // ---- Ringkasan P&L ----
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(PALETTE.ink);
  doc.text("Ringkasan", M, y); y += 6;
  const money: [string, number, string?][] = [
    ["Omzet (bersih penjualan)", report.sales],
    ["HPP (harga pokok penjualan)", report.hpp],
    ["Pengeluaran", report.expenses, "belum termasuk (modul expenses menyusul)"],
  ];
  doc.setFontSize(10);
  for (const [label, val, note] of money) {
    doc.setFont("helvetica", "normal").setTextColor(PALETTE.ink);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold");
    doc.text(rupiah(val), W - M, y, { align: "right" });
    if (note) { doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(PALETTE.gray); doc.text(note, M + 2, y + 3.5); doc.setFontSize(10); }
    y += note ? 8 : 6;
  }
  doc.setDrawColor(PALETTE.ink).line(M, y - 2, W - M, y - 2);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(PALETTE.success);
  doc.text("Keuntungan Bersih", M, y + 4);
  doc.text(rupiah(report.bersih), W - M, y + 4, { align: "right" });
  y += 12;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(PALETTE.gray);
  doc.text(`Jumlah nota: ${report.count} · Rata-rata/nota: ${rupiah(report.avg)} · Diskon: ${rupiah(report.discount)} · PPN tersirat: ${rupiah(report.tax)}`, M, y);
  y += 8;

  // ---- Charts (PNG hasil html2canvas) ----
  if (chartNodes?.method) {
    const img = await snap(chartNodes.method);
    const w = W - 2 * M;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(PALETTE.ink);
    doc.text("Metode Pembayaran", M, y); y += 2;
    doc.addImage(img, "PNG", M, y, w * 0.48, (w * 0.48) / 1.6);
    if (chartNodes.daily) {
      const img2 = await snap(chartNodes.daily);
      doc.addImage(img2, "PNG", M + w * 0.52, y, w * 0.48, (w * 0.48) / 1.6);
    }
    y += (w * 0.48) / 1.6 + 6;
  }
  if (chartNodes?.products) {
    const img = await snap(chartNodes.products);
    const w = W - 2 * M;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(PALETTE.ink);
    doc.text("Produk Teratas", M, y); y += 2;
    doc.addImage(img, "PNG", M, y, w, w / 2.6);
    y += w / 2.6 + 4;
  }

  // ---- Top produk tabel ----
  if (y > 240) { doc.addPage(); y = 18; }
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(PALETTE.ink);
  doc.text("Penjualan per Produk", M, y); y += 5;
  doc.setFontSize(8.5).setTextColor(PALETTE.gray);
  report.topProducts.slice(0, 12).forEach(([name, v]) => {
    doc.setFont("helvetica", "normal");
    doc.text(`${name}  ·  ${v.qty} pcs`, M, y);
    doc.text(rupiah(v.rev), W - M, y, { align: "right" });
    y += 4.5;
    if (y > 278) { doc.addPage(); y = 18; }
  });

  // ---- Detail per nota (tabel multi-baris) ----
  doc.addPage();
  y = 18;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(PALETTE.ink);
  doc.text("Detail Transaksi", M, y); y += 6;
  const cols = [M, M + 26, M + 40, M + 62, M + 92, M + 120, W - M];
  const headers = ["Nota", "Tanggal", "Kasir", "Metode", "Produk", "Qty", "Jumlah"];
  doc.setFontSize(8);
  const drawHead = () => {
    doc.setFont("helvetica", "bold").setTextColor(PALETTE.violet);
    headers.forEach((h, i) => doc.text(h, cols[i], y, { align: i >= 5 ? "right" : "left" }));
    y += 4;
    doc.setDrawColor(PALETTE.apricot).line(M, y - 2, W - M, y - 2);
    y += 3;
  };
  drawHead();
  let running = 0;
  doc.setFont("helvetica", "normal").setTextColor(PALETTE.ink).setFontSize(7.8);
  let lastNo = "";
  for (const l of report.lines) {
    if (y > 282) { doc.addPage(); y = 18; drawHead(); doc.setFontSize(7.8); }
    running += l.lineTotal;
    const showNo = l.number !== lastNo;
    lastNo = l.number;
    doc.text(showNo ? l.number : "", cols[0], y);
    doc.text(showNo ? l.date.slice(0, 10) : "", cols[1], y);
    doc.text(showNo ? l.cashier : "", cols[2], y);
    doc.text(showNo ? l.method : "", cols[3], y);
    doc.text(`${l.product}${l.unitCost == null ? " *" : ""}`, cols[4], y);
    doc.text(String(l.qty), cols[5], y, { align: "right" });
    doc.text(nf.format(l.lineTotal), cols[6], y, { align: "right" });
    y += 3.8;
  }
  if (y > 282) { doc.addPage(); y = 18; }
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("YTD periode ini", cols[0], y + 2);
  doc.text(nf.format(running), cols[6], y + 2, { align: "right" });

  // ---- Lampiran: harga acuan (HPP per produk) ----
  doc.addPage();
  y = 18;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(PALETTE.ink);
  doc.text("Lampiran — Harga Acuan (HPP per Produk)", M, y); y += 5;
  doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(PALETTE.gray);
  doc.text("*) = tanpa data modal (dihitung dari rata-rata movement bila tersedia; sementara 0)", M, y); y += 6;
  const costByProd: Record<string, { sum: number; qty: number; n: number }> = {};
  report.lines.forEach((l) => {
    if (l.unitCost != null) {
      const c = (costByProd[l.product] ??= { sum: 0, qty: 0, n: 0 });
      c.sum += l.unitCost * l.qty; c.qty += l.qty; c.n += 1;
    }
  });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(PALETTE.ink);
  Object.entries(costByProd).forEach(([name, c]) => {
    doc.text(name, M, y);
    doc.text(`HPP rata-rata: ${rupiah(c.sum / c.qty)}`, W - M, y, { align: "right" });
    y += 5;
    if (y > 282) { doc.addPage(); y = 18; }
  });

  doc.save(`${fileBase(meta)}.pdf`);
  return `${fileBase(meta)}.pdf`;
}

export function reportTitle(m: ExportMeta): string {
  return `Laporan Penjualan ${m.storeName ?? "KebayaOma"}`;
}

/** Sheet data (untuk PDF-headless maupun xlsx). Angka = number riil. */
export function buildSheets(report: Report, meta: ExportMeta) {
  const summary: (string | number)[][] = [
    ["Laporan", reportTitle(meta)],
    ["Periode", `${meta.from || "semua"} s.d ${meta.to || "-"}`],
    ["Outlet", meta.storeLabel],
    [],
    ["Omzet", report.sales],
    ["HPP", report.hpp],
    ["Pengeluaran (v1=0)", report.expenses],
    ["Keuntungan Bersih", report.bersih],
    ["Jumlah Nota", report.count],
    ["Rata-rata/Nota", report.avg],
    ["Diskon", report.discount],
    ["PPN tersirat", report.tax],
    ["Baris tanpa modal (qty)", report.unknownQty],
    [],
    ["Metode", "Jumlah"],
    ...Object.entries(report.byMethod).map(([k, v]) => [k, v] as (string | number)[]),
    [],
    ["Tanggal", "Penjualan"],
    ...report.byDay.map(([k, v]) => [k, v] as (string | number)[]),
    [],
    ["Produk", "Qty", "Revenue", "HPP rata-rata"],
  ];
  const costByProd: Record<string, { sum: number; qty: number }> = {};
  report.lines.forEach((l) => {
    if (l.unitCost != null) { const c = (costByProd[l.product] ??= { sum: 0, qty: 0 }); c.sum += l.unitCost * l.qty; c.qty += l.qty; }
  });
  report.topProducts.forEach(([name, v]) => {
    const c = costByProd[name];
    summary.push([name, v.qty, v.rev, c ? Math.round(c.sum / c.qty) : 0]);
  });

  const detail: (string | number | null)[][] = [[
    "Nota", "Tanggal", "Kasir", "Metode", "Produk", "SKU", "Qty",
    "Harga Unit", "Modal Unit", "Diskon", "Subtotal Baris", "Margin", "Keterangan",
  ]];
  report.lines.forEach((l) => {
    detail.push([
      l.number, l.date.slice(0, 10), l.cashier, l.method, l.product, l.sku, l.qty,
      l.unitPrice, l.unitCost, l.lineDiscount, l.lineTotal, l.margin,
      l.hasCost ? "" : "Tanpa modal",
    ]);
  });
  return { summary, detail };
}

export async function exportXlsx(report: Report, meta: ExportMeta): Promise<string> {
  const XLSX = await import("xlsx");
  const { summary, detail } = buildSheets(report, meta);
  const wb = XLSX.utils.book_new();
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  const wsDet = XLSX.utils.aoa_to_sheet(detail);
  wsSum["!cols"] = [{ wch: 26 }, { wch: 18 }];
  wsDet["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 18 }, { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 13 }, { wch: 12 }, { wch: 12 }];
  // format angka riil utk kolom numerik di Detail
  const rng = XLSX.utils.decode_range(wsDet["!ref"] ?? "A1");
  for (let r = rng.s.r + 1; r <= rng.e.r; r++) {
    for (const col of [6, 7, 8, 9, 10, 11]) {
      const cell = wsDet[XLSX.utils.encode_cell({ r, c: col })];
      if (cell && typeof cell.v === "number") { cell.t = "n"; cell.z = "#,##0"; }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsSum, "Summary");
  XLSX.utils.book_append_sheet(wb, wsDet, "Detail");
  const name = `${fileBase(meta)}.xlsx`;
  (XLSX as any).writeFile(wb, name);
  return name;
}
