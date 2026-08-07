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
  const [readyToPrint, setReadyToPrint] = useState(false);

  useEffect(() => {
    const allLabels: any[] = [];
    products.forEach((product) => {
      product.variants.forEach((variant) => {
        if (variantIds.includes(variant.id)) {
          allLabels.push({ product, variant });
        }
      });
    });
    setLabels(allLabels);
  }, [variantIds, products]);

  // Wait for labels to render, then trigger print
  useEffect(() => {
    if (labels.length > 0) {
      const timer = setTimeout(() => {
        setReadyToPrint(true);
      }, 2000); // Wait 2 seconds for barcodes to render
      return () => clearTimeout(timer);
    }
  }, [labels]);

  // Trigger print when ready
  useEffect(() => {
    if (readyToPrint) {
      window.print();
    }
  }, [readyToPrint]);

  return (
    <div className="print-page">
      {/* Header (hidden in print) */}
      <div className="no-print" style={{ padding: "20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Printing {labels.length} Barcode Labels...</h1>
        <p style={{ marginTop: "10px", color: "#666" }}>Barcodes are rendering, please wait...</p>
        <button 
          onClick={() => window.print()}
          style={{ marginTop: "20px", padding: "10px 30px", fontSize: "16px", cursor: "pointer" }}
        >
          Print Now
        </button>
      </div>

      {/* Labels (visible in print) */}
      <div className="labels-container">
        {labels.map(({ product, variant }) => (
          <div key={variant.id} className="label-item">
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
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
        }
        
        .print-page {
          padding: 20px;
        }
        
        .labels-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .label-item {
          width: 60mm;
          height: 30mm;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        @media print {
          body * {
            visibility: hidden;
          }
          
          .print-page,
          .print-page * {
            visibility: visible;
          }
          
          .print-page {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          .no-print {
            display: none !important;
          }
          
          .labels-container {
            display: block;
          }
          
          .label-item {
            page-break-inside: avoid;
            break-inside: avoid;
            margin: 5mm;
          }
        }
      `}</style>
    </div>
  );
}
