"use client";

import { useEffect, useState } from "react";
import { useData } from "@/store/data";
import BarcodeLabel from "@/components/BarcodeLabel";
import { useSearchParams } from "next/navigation";

export default function PrintBarcodePage() {
  const searchParams = useSearchParams();
  const variantIds = searchParams.get("ids")?.split(",") || [];
  const { products } = useData();
  const [labels, setLabels] = useState<any[]>([]);

  useEffect(() => {
    // Collect all variants that match the IDs
    const allLabels: any[] = [];
    products.forEach((product) => {
      product.variants.forEach((variant) => {
        if (variantIds.includes(variant.id)) {
          allLabels.push({
            product,
            variant,
          });
        }
      });
    });
    setLabels(allLabels);
  }, [variantIds, products]);

  // Auto-trigger print when page loads
  useEffect(() => {
    if (labels.length > 0) {
      setTimeout(() => {
        window.print();
      }, 500); // Small delay to ensure rendering
    }
  }, [labels]);

  return (
    <div className="p-8 print:p-0">
      {/* Header (hidden in print) */}
      <div className="mb-8 print:hidden">
        <h1 className="text-2xl font-bold">Print Barcode Labels</h1>
        <p className="text-gray-600">{labels.length} labels ready to print</p>
        <button
          onClick={() => window.print()}
          className="mt-4 px-6 py-3 bg-[#775533] text-white rounded-xl font-bold"
        >
          Print Now
        </button>
      </div>

      {/* Labels (visible in print) */}
      <div className="print-area">
        {labels.map(({ product, variant }) => (
          <div key={variant.id} className="label-container">
            <BarcodeLabel
              barcode={variant.barcode || variant.sku}
              productName={product.name}
              color={variant.color}
              size={variant.size}
              price={variant.sellingPrice}
              width={60}
              height={30}
            />
          </div>
        ))}
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .label-container {
            page-break-inside: avoid;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
