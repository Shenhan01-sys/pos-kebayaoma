"use client";

import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import BarcodeLabel from "./BarcodeLabel";
import { useData } from "@/store/data";

interface SimpleLabel {
  name: string;
  color?: string;
  size: string;
  price: number;
  barcode: string;
  vendor?: string;
}

interface PrintBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string; // Product ID to print
  // E2: preset dari restock — varian, jumlah = qty restock, konten VO + nama vendor
  preset?: { variantId: string; copies: number; barcode: string; vendorName?: string } | null;
}

export default function PrintBarcodeModal({
  isOpen,
  onClose,
  productId,
  preset,
}: PrintBarcodeModalProps) {
  const { products } = useData();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  // E15 FINAL (2026-09-24): XP-420B = label die-cut 3,3×1,5 cm, 3 label per baris,
  // liner 10,8 cm (margin tepi 0,15 + gap antar card 0,3), roll kontinu TANPA halaman.
  // Satuan baris = 1,5 label + 0,3 gap = 1,8 cm → page break wajib kelipatan 1,8.
  // 40x20/50x25/60x30 = jalur RPP02N (single label per halaman).
  const [labelSize, setLabelSize] = useState<"60x30" | "50x25" | "40x20" | "xp420b">("xp420b");
  const LABEL_DIMS: Record<string, { w: number; h: number }> = {
    "60x30": { w: 60, h: 30 },
    "50x25": { w: 50, h: 25 },
    "40x20": { w: 40, h: 20 },
    xp420b: { w: 33, h: 15 }, // 1 label (di dalam liner 108mm, 3 label/baris)
  };
  const SHEET_W = 108; // mm — lebar liner
  const ROW_PITCH = 18; // mm — 15 label + 3 gap
  const XP_COLS = 3;

  // Get products to print
  const productsToPrint = productId === "all"
    ? products
    : products.filter((p) => p.id === productId);

  // Barcode + label vendor utk varian preset (E2), selain itu default varian
  const barcodeFor = (variant: { id: string; barcode?: string | null; sku: string }) =>
    preset && preset.variantId === variant.id ? preset.barcode : variant.barcode || variant.sku;
  const vendorFor = (variantId: string) =>
    preset && preset.variantId === variantId ? preset.vendorName : undefined;

  // Auto-check all variants on open (preset → varian & copies dari restock)
  useEffect(() => {
    if (isOpen) {
      if (preset) {
        setSelectedVariants({ [preset.variantId]: preset.copies });
        return;
      }
      const allVariantsInit: Record<string, number> = {};
      productsToPrint.forEach((p) => {
        p.variants.forEach((v) => {
          allVariantsInit[v.id] = 1; // Default 1 copy each
        });
      });
      setSelectedVariants(allVariantsInit);
    }
   }, [isOpen, productId, preset]);

  // Handle checkbox toggle
  const toggleVariant = (variantId: string) => {
    setSelectedVariants((prev) => {
      const newState = { ...prev };
      if (newState[variantId]) {
        delete newState[variantId];
      } else {
        newState[variantId] = 1; // Default 1 copy
      }
      return newState;
    });
  };

  // Handle copy count change
  const updateCopyCount = (variantId: string, count: number) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [variantId]: Math.max(1, count),
    }));
  };

  // Kumpulkan label (expand qty per varian)
  const collectLabels = () => {
    const labels: { name: string; color?: string; size: string; price: number; barcode: string; vendor?: string; }[] = [];
    allVariants.forEach(({ product, variant }) => {
      const count = selectedVariants[variant.id] || 0;
      if (count === 0) return;
      for (let c = 0; c < count; c++) {
        labels.push({
          name: product.name,
          color: variant.color,
          size: variant.size,
          price: variant.sellingPrice,
          barcode: barcodeFor(variant),
          vendor: vendorFor(variant.id),
        });
      }
    });
    return labels;
  };

  // ===== E15 FINAL: XP-420B — halaman 108x144mm (8 baris x 18mm, break di gap) =====
  const xp420bDirectPrint = (labels: ReturnType<typeof collectLabels>) => {
    const ROWS_PER_PAGE = 7; // (144 - 5mm spacer) / 18 = 7 baris
    const XP_TOP_OFFSET = 5; // 8 x 1.8cm = 14.4cm — pas stock driver custom 108x144mm
    const rows = Math.ceil(labels.length / XP_COLS);
    const pages = Math.ceil(rows / ROWS_PER_PAGE);
    if (
      !confirm(
        `Print ${labels.length} label (${rows} baris × 3) — ${pages} halaman 108×144 mm.\n` +
          `WAJIB: Margin = None, Scale = 100%.`
      )
    )
      return;

    const bcImg = (code: string) => {
      const c = document.createElement("canvas");
      JsBarcode(c, code, {
        format: "CODE128",
        width: 1,
        height: 34,
        displayValue: true,
        fontSize: 8,
        margin: 0,
      });
      return c.toDataURL("image/png");
    };
    // E15 FINAL: barcode HORIZONTAL (30mm muat di lebar label 33mm) + caption di bawah
    // (barcode vertikal 30mm GAK muat di tinggi label 15mm — terbukti fisik 2026-09-25)
    const cellHTML = (l: (typeof labels)[0]) => `
      <div class="xcell">
        <img src="${bcImg(l.barcode)}" />
        <div class="xcap">${l.name}${l.size ? ` · ${l.size}` : ""} · Rp ${l.price.toLocaleString("id-ID")}</div>
      </div>`;
    const pagesHTML: string[] = [];
    for (let p = 0; p < pages; p++) {
      const rowsHTML: string[] = [];
      for (let r = 0; r < ROWS_PER_PAGE; r++) {
        const idx = (p * ROWS_PER_PAGE + r) * XP_COLS;
        if (idx >= labels.length) {
          rowsHTML.push(`<div class="xrow">${`<div class="xcell"></div>`.repeat(XP_COLS)}</div>`);
          continue;
        }
        const slice = labels.slice(idx, idx + XP_COLS);
        const pad = Array.from({ length: XP_COLS - slice.length }, () => `<div class="xcell"></div>`);
        rowsHTML.push(`<div class="xrow">${slice.map(cellHTML).join("")}${pad.join("")}</div>`);
      }
      pagesHTML.push(`<div class="xpage">${rowsHTML.join("")}</div>`);
    }

    const printWindow = window.open("", "_blank", "width=430,height=640");
    if (!printWindow) {
      alert("Popup diblokir browser. Izinkan popup untuk print barcode.");
      return;
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Barcode Labels (XP-420B)</title>
<style>
  @page { size: 108mm 144mm; margin: 0; }
  body { margin: 0; padding: 0; font-family: "Helvetica", "Arial", sans-serif; }
  .xpage { height: 144mm; overflow: hidden; page-break-after: always; box-sizing: border-box; padding-top: 5mm; }
  .xpage:last-child { page-break-after: auto; }
  .xrow {
    display: flex;
    height: 15mm;
    margin: 0 1.5mm 3mm mm;
    box-sizing: border-box;
  }
  .xrow:last-child { margin-bottom: 0; }
  .xcell {
    width: 33mm;
    height: 15mm;
    margin-right: 3mm;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }
  .xcell:nth-child(3) { margin-right: 0; }
  .xcell img { width: 30mm; max-height: 9mm; }
  .xcap {
    font-size: 4.6pt;
    color: #3a1430;
    max-width: 31mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
  }
</style>
</head>
<body>
${pagesHTML.join("")}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // ===== jalur RPP02N: direct print single label per halaman =====
  const legacyDirectPrint = (labels: ReturnType<typeof collectLabels>, dims: { w: number; h: number }) => {
    // E13: guard printer portable — RPP02N area cetak ~48mm; lebar lebih → feed nonstop.
    if (dims.w > 48) {
      const ok = confirm(
        `Label ${dims.w}mm lebih lebar dari area cetak RPP02N (~48mm).\n` +
          `Hasil bisa terpotong / feed tidak berhenti.\n` +
          `Disarankan pakai label 40x20. Tetap lanjut print?`
      );
      if (!ok) return;
    }
    if (!confirm(`Print ${labels.length} label (${dims.w}x${dims.h}mm) via printer?`)) return;

    const labelHTML = labels
      .map((label) => {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, label.barcode, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 10,
          margin: 0,
        });
        const barcodeImg = canvas.toDataURL("image/png");
        return `
        <div class="label" style="width:${dims.w}mm;height:${dims.h}mm;">
          <div class="label-barcode">
            <img src="${barcodeImg}" style="max-width:100%;max-height:${dims.h * 0.6}mm;" />
          </div>
          <div class="label-info">
            <div class="label-name">${label.name}</div>
            ${label.color ? `<div class="label-color">${label.color}</div>` : ""}
            ${label.vendor ? `<div class="label-color">Vend: ${label.vendor}</div>` : ""}
            <div class="label-size">Size: ${label.size}</div>
            <div class="label-price">Rp ${label.price.toLocaleString("id-ID")}</div>
          </div>
        </div>`;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      alert("Popup diblokir browser. Izinkan popup untuk print barcode.");
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Barcode Labels</title>
<style>
  @page {
    size: ${dims.w}mm ${dims.h}mm;
    margin: 0;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: "Helvetica", "Arial", sans-serif;
  }
  .label {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding: 1mm;
    page-break-after: always;
    overflow: hidden;
  }
  .label-barcode {
    flex: 0 0 60%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .label-info {
    flex: 1;
    padding-left: 1mm;
    font-size: 7pt;
    line-height: 1.3;
    color: #3a1430;
  }
  .label-name {
    font-weight: bold;
    font-size: 8pt;
    margin-bottom: 0.5mm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label-color { color: #666; font-size: 6pt; }
  .label-size { color: #666; font-size: 6pt; }
  .label-price { font-weight: bold; color: #775533; margin-top: 0.5mm; }
</style>
</head>
<body>
${labelHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleDirectPrint = () => {
    const labels = collectLabels();
    if (labels.length === 0) return;
    if (labelSize === "xp420b") return xp420bDirectPrint(labels);
    return legacyDirectPrint(labels, LABEL_DIMS[labelSize]);
  };

  // ===== E15 FINAL: XP-420B — PDF 1 halaman memanjang (tinggi = baris × 1,8cm, tanpa potong) =====
  const xp420bPdf = (labels: SimpleLabel[]) => {
    const XP_TOP_OFFSET = 5;
    const rows = Math.ceil(labels.length / XP_COLS);
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [SHEET_W, XP_TOP_OFFSET + rows * ROW_PITCH],
    });

    const imgCache = new Map<string, { image: string; ratio: number }>();
    const imgFor = (label: SimpleLabel) => {
      if (!imgCache.has(label.barcode)) {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, label.barcode, {
          format: "CODE128",
          width: 2,
          height: 40,
          displayValue: false,
          margin: 0,
        });
        imgCache.set(label.barcode, {
          image: canvas.toDataURL("image/png"),
          ratio: canvas.height / canvas.width,
        });
      }
      return imgCache.get(label.barcode)!;
    };

    labels.forEach((label, i) => {
      const row = Math.floor(i / XP_COLS);
      const colI = i % XP_COLS;
      const x = 1.5 + colI * (33 + 3);
      const y = XP_TOP_OFFSET + row * ROW_PITCH;

      const { image, ratio } = imgFor(label);
      const bw = 30; // barcode 30mm — muat di lebar label 33mm
      const bh = Math.min(bw / ratio, 9.5);
      doc.addImage(image, "PNG", x + (33 - bw) / 2, y + 1, bw, bh);
      doc.setFont("helvetica", "normal").setFontSize(5).setTextColor(58, 20, 48);
      doc.text(
        `${label.name}${label.size ? ` · ${label.size}` : ""} · Rp ${label.price.toLocaleString("id-ID")}`,
        x + 16.5,
        y + 13.4,
        { align: "center", maxWidth: 32 }
      );
    });

    doc.save("barcode-labels-xp420b.pdf");
    onClose();
  };

  // ===== jalur RPP02N: PDF A4 sticker sheet =====
  const legacyPdf = (labels: SimpleLabel[], dims: { w: number; h: number }) => {
    const margin = 5;
    const gap = 2;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const cols = Math.floor((210 - margin * 2 + gap) / (dims.w + gap));
    const rows = Math.floor((297 - margin * 2 + gap) / (dims.h + gap));
    const perPage = cols * rows;

    labels.forEach((label, i) => {
      if (i > 0 && i % perPage === 0) doc.addPage("a4", "portrait");

      const posInPage = i % perPage;
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      const x = margin + col * (dims.w + gap);
      const y = margin + row * (dims.h + gap);

      doc.setDrawColor(200, 200, 200);
      doc.rect(x, y, dims.w, dims.h);

      const infoX = x + dims.w * 0.68;
      const infoW = dims.w - (infoX - x) - 2;
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, label.barcode, {
        format: "CODE128",
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0,
      });
      const barcodeW = infoX - x - 3;
      const barcodeH = Math.min(barcodeW * 0.4, dims.h * 0.55);
      doc.addImage(canvas.toDataURL("image/png"), "PNG", x + 1.5, y + 2, barcodeW, barcodeH);

      doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(80, 80, 80);
      doc.text(label.barcode, x + 1.5 + barcodeW / 2, y + barcodeH + 5, { align: "center" });

      doc.setTextColor(58, 20, 48);
      doc.setFont("helvetica", "bold").setFontSize(8);
      const nameLines = doc.splitTextToSize(label.name, infoW).slice(0, 2);
      doc.text(nameLines, infoX, y + 4);

      doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(100, 100, 100);
      let textY = y + 4 + nameLines.length * 3.5;
      if (label.color) { doc.text(label.color, infoX, textY); textY += 3.5; }
      if (label.vendor) { doc.text(`Vend: ${label.vendor}`, infoX, textY); textY += 3.5; }
      doc.text(`Size: ${label.size}`, infoX, textY);

      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(119, 85, 51);
      doc.text(`Rp ${label.price.toLocaleString("id-ID")}`, infoX, y + dims.h - 4);
    });

    doc.save("barcode-labels.pdf");
    onClose();
  };

  const handlePrint = async () => {
    const labels = collectLabels();
    if (labels.length === 0) return;
    if (labelSize === "xp420b") return xp420bPdf(labels);
    return legacyPdf(labels, LABEL_DIMS[labelSize]);
  };

  // Calculate total labels
  const totalLabels = Object.values(selectedVariants).reduce((a, b) => a + b, 0);

  // Get all variants from selected products
  const allVariants = productsToPrint.flatMap((p) =>
    p.variants.map((v) => ({
      product: p,
      variant: v,
    }))
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
            <DialogTitle className="text-xl font-bold text-[#3a1430]">
              Print Barcode Label
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-1">
              {productId === "all" ? `All Products (${productsToPrint.length})` : productsToPrint[0]?.name}
            </p>
          </div>

          {/* Body */}
          <div className="p-6">
             {/* Quick Actions */}
             <div className="grid grid-cols-2 gap-3 mb-6">
               <button
                 onClick={() => {
                   const all: Record<string, number> = {};
                    allVariants.forEach(({ product, variant }) => {
                      if (product.stock > 0) all[variant.id] = 1;
                    });
                   setSelectedVariants(all);
                 }}
                 className="p-4 bg-[#775533]/10 text-[#775533] rounded-xl hover:bg-[#775533]/20 transition text-center"
               >
                 <div className="font-bold text-sm">Select All In Stock</div>
                  <div className="text-xs mt-1">
                    {allVariants.filter(({ product }) => product.stock > 0).length} variants
                  </div>
               </button>
               <button
                 onClick={() => {
                   setSelectedVariants({});
                 }}
                 className="p-4 bg-gray-100 rounded-xl hover:bg-gray-200 transition text-center"
               >
                 <div className="font-bold text-sm">Clear All</div>
                 <div className="text-xs mt-1">Reset selection</div>
               </button>
             </div>

             {/* Variant List */}
             <div className="mb-6">
               <h3 className="text-sm font-semibold text-[#3a1430] mb-3">
                 Pilih Variant yang akan di-print:
               </h3>
               {allVariants.map(({ product, variant }) => (
                <div
                  key={variant.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl mb-2 hover:bg-[#F2F5E2]/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedVariants[variant.id]}
                    onChange={() => toggleVariant(variant.id)}
                    className="w-5 h-5 text-[#775533] rounded focus:ring-[#775533]"
                  />
                   <div className="flex-1">
                     <div className="font-medium text-sm">
                       {product.name} - Size: {variant.size} - {variant.color}
                     </div>
                      <div className="text-xs text-gray-600">
                        Barcode: {variant.barcode || "N/A"} | Stock: {product.stock}
                      </div>
                   </div>
                  {selectedVariants[variant.id] && (
                    <input
                      type="number"
                      value={selectedVariants[variant.id]}
                      onChange={(e) =>
                        updateCopyCount(variant.id, parseInt(e.target.value) || 1)
                      }
                      min={1}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Label Size */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#3a1430] mb-3">
                Label Size:
              </h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: "xp420b", label: "3.3cm x 1.5cm ×3", desc: "XP-420B — liner 10.8cm, die-cut roll" },
                  { value: "40x20", label: "40mm x 20mm", desc: "RPP02N" },
                  { value: "50x25", label: "50mm x 25mm", desc: "Memanjang" },
                  { value: "60x30", label: "60mm x 30mm", desc: "Lebih Lega" },
                ].map((size) => (
                  <label key={size.value} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="label-size"
                      value={size.value}
                      checked={labelSize === size.value}
                      onChange={() => setLabelSize(size.value as any)}
                      className="peer hidden"
                    />
                    <div className="p-3 border-2 border-gray-200 rounded-xl peer-checked:border-[#775533] peer-checked:bg-[#775533]/5 text-center hover:bg-gray-50 transition">
                      <div className="font-semibold text-sm">{size.label}</div>
                      <div className="text-xs text-gray-600 mt-1">{size.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              {labelSize === "xp420b" && (
                <p className="mt-2 text-xs text-gray-600">
                  Roll die-cut siap pakai: 3 label per baris, liner 10,8 cm, roll terus tanpa potong halaman.
                  Print dialog: <b>Margin = None</b>.
                </p>
              )}
            </div>

            {/* Preview */}
            {Object.keys(selectedVariants).length > 0 && (
              <div className="mb-6 p-4 bg-[#F2F5E2] rounded-xl">
                <h3 className="text-sm font-semibold text-[#3a1430] mb-3">
                  Preview ({Object.keys(selectedVariants).length} labels):
                </h3>
                <div className="space-y-2">
                  {allVariants
                    .filter(({ variant }) => selectedVariants[variant.id])
                    .slice(0, 3) // Show max 3 previews
                    .map(({ product, variant }) => (
                      <BarcodeLabel
                        key={variant.id}
                        barcode={variant.barcode || variant.sku}
                        productName={product.name}
                        color={variant.color}
                        size={variant.size}
                        price={variant.sellingPrice}
                        width={LABEL_DIMS[labelSize].w}
                        height={LABEL_DIMS[labelSize].h}
                      />
                    ))}
                  {Object.keys(selectedVariants).length > 3 && (
                    <p className="text-xs text-gray-600 text-center">
                      +{Object.keys(selectedVariants).length - 3} more labels...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total Labels:</div>
                  <div className="text-2xl font-bold text-blue-700">{totalLabels}</div>
                  {labelSize === "xp420b" && (
                    <div className="text-xs text-gray-600">
                      {Math.ceil(totalLabels / XP_COLS)} baris × 3 label — liner 10,8 cm
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Estimasi Waktu:</div>
                  <div className="text-lg font-semibold text-gray-800">
                    ~{totalLabels * 3} detik
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex items-center justify-between gap-2">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleDirectPrint}
                disabled={totalLabels === 0}
                title="Print langsung ke printer thermal (Bluetooth/USB/WiFi) via browser print dialog"
                className="px-6 py-3 bg-white border-2 border-[#775533] text-[#775533] rounded-xl hover:bg-[#775533]/5 font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L4 16m0 0l2-2m-2 2h16M6 6l2-2m0 0L6 2m2 2H4m16 0v4M4 6v4m16 4v4M4 14v4" />
                </svg>
                Direct Print
              </button>
              <button
                onClick={handlePrint}
                disabled={totalLabels === 0}
                className="px-8 py-3 bg-[#775533] text-white rounded-xl hover:bg-[#775533]/90 font-bold transition flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Print {totalLabels} Labels
            </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
