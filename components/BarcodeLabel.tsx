"use client";

import React, { useRef, useEffect } from "react";
import JsBarcode from "jsbarcode";

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

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, barcode, {
        format: "CODE128",
        width: 1.5,
        height: 50,
        displayValue: false,
        margin: 0,
      });
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
        <svg ref={svgRef} className="w-full" style={{ height: "60%" }} />
        <div className="text-[8px] text-center mt-1">{barcode}</div>
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
