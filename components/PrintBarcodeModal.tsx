"use client";

import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import BarcodeLabel from "./BarcodeLabel";
import { useData } from "@/store/data";

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
  // E13: default 40x20 — pas untuk RPP02N (kertas 58mm, area cetak ~48mm, feed max 20mm).
  // 60x30/50x25 terlalu lebar/tinggi → printer feed nonstop mencari gap sensor.
  // E15: +25x45 (roll Xprinter XP-420B, 25mm lebar × 45mm tinggi portrait).
  const [labelSize, setLabelSize] = useState<"60x30" | "50x25" | "40x20" | "25x45" | "100x150">("100x150");
  const LABEL_DIMS: Record<string, { w: number; h: number }> = {
    "60x30": { w: 60, h: 30 },
    "50x25": { w: 50, h: 25 },
    "40x20": { w: 40, h: 20 },
    "25x45": { w: 25, h: 45 },
    "100x150": { w: 100, h: 150 },
  };
  // E15: mode cetak — default GRID (kertas 100x150 = 9 sub-label; single utk kasus khusus)
  const [printMode, setPrintMode] = useState<"single" | "grid">("grid");
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(3);

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

  // Direct print via browser — supports thermal printer (Bluetooth/USB/WiFi)
  const handleDirectPrint = () => {
    const { w: labelWidth, h: labelHeight } = LABEL_DIMS[labelSize];
    const isGrid = printMode === "grid";
    const perLabel = gridCols * gridRows;

    // Collect labels (single) / cells (grid)
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

    if (labels.length === 0) return;

    // E13: guard printer portable — RPP02N area cetak ~48mm; lebar lebih → feed nonstop.
    if (labelWidth > 48) {
      const ok = confirm(
        `Label ${labelWidth}mm lebih lebar dari area cetak RPP02N (~48mm).\n` +
          `Hasil bisa terpotong / feed tidak berhenti.\n` +
          `Disarankan pakai label 40x20. Tetap lanjut print?`
      );
      if (!ok) return;
    }

    // E15: grid mode —peringatan scannability: CODE128 butuh ±0.125mm per modul di 203dpi.
    let gridWarn = "";
    if (isGrid) {
      const cellW = labelWidth / gridCols;
      const longest = Math.max(...labels.map((l) => l.barcode.length));
      const minMm = 0.125 * (11 * longest + 35) + 4;
      if (cellW < minMm) {
        gridWarn = `\n⚠️ Kode terpanjang (${longest} karakter) butuh ±${minMm.toFixed(0)}mm — kolom grid ini hanya ${cellW.toFixed(0)}mm.\nBarcode bisa gagal discan! Kurangi jumlah kolom.`;
      }
    }
    if (!confirm(
      isGrid
        ? `Print ${labels.length} barcode dalam ${Math.ceil(labels.length / perLabel)} label grid ${gridCols}×${gridRows} (${labelWidth}x${labelHeight}mm)?${gridWarn}`
        : `Print ${labels.length} label (${labelWidth}x${labelHeight}mm) via printer?`
    )) return;

    // Generate barcode SVGs
    const barcodeImgFor = (barcode: string, small = false, rotate = false) => {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, barcode, {
        format: "CODE128",
        width: small ? 1 : 2,
        height: small ? 28 : 50,
        displayValue: true,
        fontSize: small ? 7 : 10,
        margin: 0,
      });
      if (!rotate) return canvas.toDataURL("image/png");
      // putar 90° CW — panjang barcode mengikuti sisi TINGGI sel (sub-label portrait)
      const rot = document.createElement("canvas");
      rot.width = canvas.height;
      rot.height = canvas.width;
      const ctx = rot.getContext("2d")!;
      ctx.translate(rot.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(canvas, 0, 0);
      return rot.toDataURL("image/png");
    };

    let labelHTML: string;
    // E15 grid: kartu didesain LANDSCAPE (barcode kiri, info kanan) lalu SELURUH kartu
    // diputar 90° ke kanan di dalam sel portrait — kayak hangtag (konten menghadap samping).
    const card90HTML = (label: (typeof labels)[0], cw: number, ch: number) => `
      <div class="card90" style="width:${ch}mm;height:${cw}mm;">
        <div class="label-barcode"><img src="${barcodeImgFor(label.barcode, true)}" style="max-width:100%;max-height:${cw * 0.85}mm;" /></div>
        <div class="label-info">
          <div class="label-name">${label.name}</div>
          ${label.color ? `<div class="label-color">${label.color}</div>` : ""}
          <div class="label-size">Size: ${label.size}</div>
          <div class="label-price">Rp ${label.price.toLocaleString("id-ID")}</div>
        </div>
      </div>`;
    // E13 single: label utuh tegak (barcode kiri, info kanan) — tidak dirotasi
    const uprightHTML = (label: (typeof labels)[0], w: number, h: number, small: boolean) => {
      const img = barcodeImgFor(label.barcode, small);
      return `
      <div class="sub" style="width:${w}mm;height:${h}mm;">
        <div class="label-barcode"><img src="${img}" style="max-width:100%;max-height:${h * 0.6}mm;" /></div>
        <div class="label-info">
          <div class="label-name">${label.name}</div>
          ${label.color ? `<div class="label-color">${label.color}</div>` : ""}
          ${label.vendor ? `<div class="label-color">Vend: ${label.vendor}</div>` : ""}
          <div class="label-size">Size: ${label.size}</div>
          <div class="label-price">Rp ${label.price.toLocaleString("id-ID")}</div>
        </div>
      </div>`;
    };
    if (isGrid) {
      // E15: 1 halaman = 1 KERTAS label (mis. 10x15cm) berisi 9 kartu yang diputar 90°
      const cellW = labelWidth / gridCols;
      const cellH = labelHeight / gridRows;
      const chunks: (typeof labels)[] = [];
      for (let i = 0; i < labels.length; i += perLabel) chunks.push(labels.slice(i, i + perLabel));
      labelHTML = chunks
        .map(
          (cells) => `
        <div class="label sheet" style="width:${labelWidth}mm;height:${labelHeight}mm;grid-template-columns:repeat(${gridCols},1fr);grid-template-rows:repeat(${gridRows},1fr);">
          ${cells.map((l) => `<div class="cell">${card90HTML(l, cellW, cellH)}</div>`).join("")}
        </div>`
        )
        .join("");
    } else {
      labelHTML = labels
        .map((label) => `
        <div class="label" style="width:${labelWidth}mm;height:${labelHeight}mm;">
          ${uprightHTML(label, labelWidth - 2, labelHeight - 2, false)}
        </div>`)
        .join("");
    }

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
    size: ${labelWidth}mm ${labelHeight}mm;
    margin: 0;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: "Helvetica", "Arial", sans-serif;
  }
  .label {
    box-sizing: border-box;
    page-break-after: always;
    overflow: hidden;
    border: 0.3mm dashed #b0b0b0;
  }
  .label.sheet {
    display: grid;
    padding: 0.5mm;
  }
  .cell {
    box-sizing: border-box;
    border: 0.3mm dashed #b0b0b0;
    position: relative;
    overflow: hidden;
  }
  /* kartu landscape (w=h-sel, h=w-sel) diputar 90° CW di tengah sel */
  .card90 {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(90deg);
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0.5mm;
    overflow: hidden;
  }
  .card90 .label-barcode {
    flex: 0 0 68%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card90 .label-barcode img {
    max-width: 100%;
    max-height: 100%;
  }
  .card90 .label-info {
    flex: 1;
    min-width: 0;
    padding-left: 1mm;
  }
  .sub {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0.4mm;
    overflow: hidden;
  }
  .sub .label-barcode {
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

  // Print handler - single: PDF A4 berisi banyak label; grid (E15): PDF per-label
  // seukuran label fisik (proyeksi 1:1 ke printer label)
  const handlePrint = async () => {
    const { w: labelWidth, h: labelHeight } = LABEL_DIMS[labelSize];
    const isGrid = printMode === "grid";
    const margin = 5;
    const gap = 2;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: isGrid ? [labelWidth, labelHeight] : "a4",
    });

    // Grid: how many labels fit per A4 page (single mode)
    const cols = isGrid ? gridCols : Math.floor((210 - margin * 2 + gap) / (labelWidth + gap));
    const rows = isGrid ? gridRows : Math.floor((297 - margin * 2 + gap) / (labelHeight + gap));
    const perPage = cols * rows;

    // Collect labels (expanded by copy count)
    const labels: {
      name: string;
      color?: string;
      size: string;
      price: number;
      barcode: string;
      vendor?: string;
      image: string;
      ratio: number;
      rotImage: string;
    }[] = [];

    allVariants.forEach(({ product, variant }) => {
      const count = selectedVariants[variant.id] || 0;
      if (count === 0) return;

      // Generate barcode image once per variant
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, barcodeFor(variant), {
        format: "CODE128",
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0,
      });
      const image = canvas.toDataURL("image/png");
      const ratio = canvas.height / canvas.width; // aspect utk grid cells (anti gepeng)
      // versi rotasi 90° CW utk sel portrait (panjang barcode = tinggi sel)
      const rot = document.createElement("canvas");
      rot.width = canvas.height;
      rot.height = canvas.width;
      const rctx = rot.getContext("2d")!;
      rctx.translate(rot.width, 0);
      rctx.rotate(Math.PI / 2);
      rctx.drawImage(canvas, 0, 0);
      const rotImage = rot.toDataURL("image/png");

      for (let c = 0; c < count; c++) {
        labels.push({
          name: product.name,
          color: variant.color,
          size: variant.size,
          price: variant.sellingPrice,
          barcode: barcodeFor(variant),
          vendor: vendorFor(variant.id),
          image,
          ratio,
          rotImage,
        });
      }
    });

    // Draw labels in grid
    const cardCache = new Map<string, string>();
    const card90Image = async (label: (typeof labels)[0]): Promise<string> => {
      if (cardCache.has(label.barcode)) return cardCache.get(label.barcode)!;
      const { default: html2canvas } = await import("html2canvas");
      const holder = document.createElement("div");
      holder.style.cssText = "position:fixed;left:-9999px;top:0;";
      holder.innerHTML = `
        <div style="width:340px;height:188px;box-sizing:border-box;display:flex;align-items:center;background:#fff;font-family:Helvetica,Arial,sans-serif;">
          <div style="flex:0 0 66%;display:flex;align-items:center;justify-content:center;padding:8px;min-width:0;">
            <img data-bc />
          </div>
          <div style="flex:1;padding:0 10px 0 2px;min-width:0;">
            <div style="font-weight:bold;font-size:15px;color:#3a1430;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label.name}</div>
            ${label.color ? `<div style="font-size:11px;color:#666;">${label.color}</div>` : ""}
            <div style="font-size:11px;color:#666;">Size: ${label.size}</div>
            <div style="font-size:14px;font-weight:bold;color:#775533;margin-top:4px;">Rp ${label.price.toLocaleString("id-ID")}</div>
          </div>
        </div>`;
      document.body.appendChild(holder);
      const bc = holder.querySelector("img[data-bc]") as unknown as HTMLCanvasElement;
      JsBarcode(bc as unknown as HTMLCanvasElement, label.barcode, {
        format: "CODE128",
        width: 2,
        height: 56,
        displayValue: true,
        fontSize: 13,
        margin: 0,
      });
      const card = await html2canvas(holder.firstChild as HTMLElement, { scale: 2, backgroundColor: "#ffffff", logging: false });
      holder.remove();
      // putar seluruh kartu 90° CW → portrait pas sel
      const rot = document.createElement("canvas");
      rot.width = card.height;
      rot.height = card.width;
      const rctx = rot.getContext("2d")!;
      rctx.translate(rot.width, 0);
      rctx.rotate(Math.PI / 2);
      rctx.drawImage(card, 0, 0);
      const url = rot.toDataURL("image/png");
      cardCache.set(label.barcode, url);
      return url;
    };

    let cellIdx = 0;
    for (const label of labels) {
      const i = cellIdx;
      cellIdx++;
      if (i > 0 && i % perPage === 0) {
        if (isGrid) doc.addPage([labelWidth, labelHeight], "portrait");
        else doc.addPage("a4", "portrait");
      }

      const posInPage = i % perPage;
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);

      if (isGrid) {
        // E15: halaman = 1 kertas label; tiap sel = KARTU UTUH dirotasi 90° CW (raster)
        const cellW = labelWidth / cols;
        const cellH = labelHeight / rows;
        const cx = col * cellW;
        const cy = row * cellH;

        doc.setDrawColor(150, 150, 150);
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.rect(cx, cy, cellW, cellH);
        doc.setLineDashPattern([], 0);

        const cardImg = await card90Image(label);
        doc.addImage(cardImg, "PNG", cx + 0.6, cy + 0.6, cellW - 1.2, cellH - 1.2);
        continue;
      }

      const x = margin + col * (labelWidth + gap);
      const y = margin + row * (labelHeight + gap);

      // Label border (light, for cutting)
      doc.setDrawColor(200, 200, 200);
      doc.rect(x, y, labelWidth, labelHeight);

      // Layout: barcode left (~68%), info right
      const infoX = x + labelWidth * 0.68;
      const infoW = labelWidth - (infoX - x) - 2;

      // Barcode image
      const barcodeW = infoX - x - 3;
      const barcodeH = Math.min(barcodeW * 0.4, labelHeight * 0.55);
      doc.addImage(label.image, "PNG", x + 1.5, y + 2, barcodeW, barcodeH);

      // Barcode text below image
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.text(label.barcode, x + 1.5 + barcodeW / 2, y + barcodeH + 5, {
        align: "center",
      });

      // Product info (right column)
      doc.setTextColor(58, 20, 48); // #3a1430
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const nameLines = doc.splitTextToSize(label.name, infoW).slice(0, 2);
      doc.text(nameLines, infoX, y + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      let textY = y + 4 + nameLines.length * 3.5;
      if (label.color) {
        doc.text(label.color, infoX, textY);
        textY += 3.5;
      }
      if (label.vendor) {
        doc.text(`Vend: ${label.vendor}`, infoX, textY);
        textY += 3.5;
      }
      doc.text(`Size: ${label.size}`, infoX, textY);

      // Price at bottom of label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(119, 85, 51); // #775533
      doc.text(`Rp ${label.price.toLocaleString("id-ID")}`, infoX, y + labelHeight - 4);
    }

    // Download PDF
    doc.save("barcode-labels.pdf");
    onClose();
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
                  { value: "100x150", label: "100mm x 150mm", desc: "Resi/A6 — grid 3×3 (9 barcode)" },
                  { value: "25x45", label: "25mm x 45mm", desc: "Roll kecil (portrait)" },
                  { value: "60x30", label: "60mm x 30mm", desc: "Lebih Lega" },
                  { value: "50x25", label: "50mm x 25mm", desc: "Memanjang" },
                  { value: "40x20", label: "40mm x 20mm", desc: "RPP02N" },
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
            </div>

            {/* Print Mode (E15) */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#3a1430] mb-3">Mode Cetak:</h3>
              <div className="flex gap-3 mb-3">
                {[
                  { value: "single", label: "Single", desc: "1 barcode + info per label" },
                  { value: "grid", label: "Grid", desc: "Banyak barcode per label" },
                ].map((m) => (
                  <label key={m.value} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="print-mode"
                      value={m.value}
                      checked={printMode === m.value}
                      onChange={() => setPrintMode(m.value as any)}
                      className="peer hidden"
                    />
                    <div className="p-3 border-2 border-gray-200 rounded-xl peer-checked:border-[#775533] peer-checked:bg-[#775533]/5 text-center hover:bg-gray-50 transition">
                      <div className="font-semibold text-sm">{m.label}</div>
                      <div className="text-xs text-gray-600 mt-1">{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              {printMode === "grid" && (
                <div className="flex items-center gap-4 p-3 bg-[#F2F5E2] rounded-xl">
                  <label className="text-sm">
                    Kolom:{" "}
                    <select
                      value={gridCols}
                      onChange={(e) => setGridCols(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded-lg"
                    >
                      {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    Baris:{" "}
                    <select
                      value={gridRows}
                      onChange={(e) => setGridRows(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded-lg"
                    >
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <span className="text-xs text-gray-600">
                    {gridCols * gridRows} barcode per label — qty tiap barcode diatur di daftar atas.
                    ⚠️ Sel terlalu sempit = barcode bisa gagal discan (lihat peringatan saat print).
                  </span>
                </div>
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
                        width={labelSize === "60x30" ? 60 : labelSize === "50x25" ? 50 : 40}
                        height={labelSize === "60x30" ? 30 : labelSize === "50x25" ? 25 : 20}
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
                  <div className="text-sm text-gray-600">
                    {printMode === "grid" ? "Total Barcode:" : "Total Labels:"}
                  </div>
                  <div className="text-2xl font-bold text-blue-700">{totalLabels}</div>
                  {printMode === "grid" && (
                    <div className="text-xs text-gray-600">
                      ≈ {Math.ceil(totalLabels / (gridCols * gridRows))} label fisik ({gridCols}×{gridRows})
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Estimasi Waktu:</div>
                  <div className="text-lg font-semibold text-gray-800">
                    ~{(printMode === "grid" ? Math.ceil(totalLabels / (gridCols * gridRows)) : totalLabels) * 3} detik
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
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
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
