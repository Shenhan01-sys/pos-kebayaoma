"use client";

import { useEffect, useState } from "react";
import { useData } from "@/store/data";
import { useSearchParams } from "next/navigation";

export default function PrintBarcodePage() {
  const searchParams = useSearchParams();
  const variantIds = searchParams.get("ids")?.split(",") || [];
  const { products } = useData();
  const [labels, setLabels] = useState<any[]>([]);

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

  // Auto-trigger print when ready
  useEffect(() => {
    if (labels.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [labels]);

  return (
    <div className="print-page">
      {/* Header (hidden in print) */}
      <div className="no-print" style={{ padding: "20px", textAlign: "center" }}>
        <h1>Printing {labels.length} Barcode Labels...</h1>
        <button onClick={() => window.print()} style={{ padding: "10px 20px", fontSize: "16px" }}>
          Print Now
        </button>
      </div>

      {/* Labels (visible in print) */}
      <div className="labels-container">
        {labels.map(({ product, variant }) => (
          <div key={variant.id} className="label-item">
            {/* Barcode */}
            <div className="barcode-container">
              <svg className="barcode-svg" data-barcode={variant.barcode || variant.sku}></svg>
            </div>
            {/* Product Info */}
            <div className="info-container">
              <div className="product-name">{product.name}</div>
              <div className="variant-info">Size: {variant.size}</div>
              <div className="price">Rp {variant.sellingPrice.toLocaleString("id-ID")}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Generate barcodes on client */}
      <script dangerouslySetInnerHTML={{
        __html: `
          document.querySelectorAll('.barcode-svg').forEach((svg) => {
            const barcode = svg.getAttribute('data-barcode');
            if (barcode && window.JsBarcode) {
              window.JsBarcode(svg, barcode, {
                format: 'CODE128',
                width: 1.5,
                height: 40,
                displayValue: false
              });
            }
          });
        `
      }} />

      {/* Styles */}
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
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          padding: 8px;
          box-sizing: border-box;
          page-break-inside: avoid;
        }
        
        .barcode-container {
          flex: 1;
          overflow: hidden;
        }
        
        .barcode-svg {
          width: 100%;
          height: 50px;
        }
        
        .info-container {
          text-align: right;
          padding-left: 12px;
          flex-shrink: 0;
        }
        
        .product-name {
          font-weight: bold;
          font-size: 11px;
          color: #3a1430;
        }
        
        .variant-info {
          font-size: 9px;
          color: #666;
        }
        
        .price {
          font-weight: bold;
          color: #775533;
          font-size: 10px;
          margin-top: 2px;
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
          }
        }
      `}</style>
    </div>
  );
}
