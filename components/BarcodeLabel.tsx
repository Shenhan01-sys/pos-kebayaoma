"use client";

import React, { useRef, useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import { isCode128Printable } from "@/lib/barcode";

interface BarcodeLabelProps {
  barcode: string; // Barcode value (e.g., "8995501S")
  productName: string;
  color?: string;
  size: string;
  chestCircumference?: string; // Lingkar dada (optional)
  price: number;
  width?: number; // Label width in mm (default: 60)
  height?: number; // Label height in mm (default: 30)
}

export default function BarcodeLabel({
  barcode,
  productName,
  color,
  size,
  chestCircumference,
  price,
  width = 60,
  height = 30,
}: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // kode kosong / tak valid → tampil "tanpa barcode", bukan crash seluruh halaman (temuan 2026-10-16)
  const [invalid, setInvalid] = useState(!isCode128Printable(barcode));

  useEffect(() => {
    if (!svgRef.current) return;
    if (!isCode128Printable(barcode)) {
      setInvalid(true);
      return;
    }
    try {
      JsBarcode(svgRef.current, barcode, {
        format: "CODE128",
        width: 1.5,
        height: 50,
        displayValue: false,
        margin: 0,
      });
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
  }, [barcode]);

  // Convert mm to px (approximate: 1mm = 3.78px)
  const widthPx = width * 3.78;
  const heightPx = height * 3.78;

  return (
    <div
      className="border-2 border-dashed border-gray-300 bg-white flex items-center p-2"
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
    >
      {/* Barcode */}
      <div className="flex-1">
        <svg ref={svgRef} className={invalid ? "hidden" : "w-full"} style={{ height: "60%" }} />
        {invalid ? (
          <div className="text-[9px] text-center text-red-600 font-semibold">Tanpa barcode</div>
        ) : (
          <div className="text-[8px] text-center mt-1">{barcode}</div>
        )}
      </div>

      {/* Product Info */}
      <div className="text-right pl-3" style={{ fontSize: "10px" }}>
        <div className="font-bold" style={{ fontSize: "12px" }}>
          {productName.length > 15
            ? productName.substring(0, 15) + "..."
            : productName}
        </div>
        {color && <div className="text-gray-600" style={{ fontSize: "9px" }}>{color}</div>}
        <div style={{ fontSize: "9px" }}>
          Size: {size}
          {chestCircumference && ` | ${chestCircumference}`}
        </div>
        <div className="font-semibold text-[#775533]" style={{ fontSize: "11px", marginTop: "2px" }}>
          Rp {price.toLocaleString("id-ID")}
        </div>
      </div>
    </div>
  );
}
