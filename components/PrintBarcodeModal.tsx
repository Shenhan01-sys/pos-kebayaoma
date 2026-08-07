"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import BarcodeLabel from "./BarcodeLabel";
import { useData } from "@/store/data";

interface PrintBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string; // Product ID to print
}

export default function PrintBarcodeModal({
  isOpen,
  onClose,
  productId,
}: PrintBarcodeModalProps) {
  const { products } = useData();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  const [labelSize, setLabelSize] = useState<"60x30" | "50x25" | "40x20">("60x30");

  // Get products to print
  const productsToPrint = productId === "all" 
    ? products 
    : products.filter((p) => p.id === productId);

  // Auto-check all variants on open
  useEffect(() => {
    if (isOpen) {
      const allVariants: Record<string, number> = {};
      productsToPrint.forEach((p) => {
        p.variants.forEach((v) => {
          allVariants[v.id] = 1; // Default 1 copy each
        });
      });
      setSelectedVariants(allVariants);
    }
  }, [isOpen, productId]);

  if (!product) return null;

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

  // Print handler
  const handlePrint = () => {
    // In a real app, this would generate a print-friendly page
    // For now, we'll use window.print() with a hidden print area
    window.print();
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
                   allVariants.forEach(({ variant }) => {
                     if (variant.stock > 0) all[variant.id] = 1;
                   });
                   setSelectedVariants(all);
                 }}
                 className="p-4 bg-[#775533]/10 text-[#775533] rounded-xl hover:bg-[#775533]/20 transition text-center"
               >
                 <div className="font-bold text-sm">Select All In Stock</div>
                 <div className="text-xs mt-1">
                   {allVariants.filter(({ variant }) => variant.stock > 0).length} variants
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
                       Barcode: {variant.barcode || "N/A"} | Stock: {variant.stock}
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
              <div className="flex gap-3">
                {[
                  { value: "60x30", label: "60mm x 30mm", desc: "Lebih Lega (Recommended)" },
                  { value: "50x25", label: "50mm x 25mm", desc: "Memanjang" },
                  { value: "40x20", label: "40mm x 20mm", desc: "Minimalis" },
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
                  <div className="text-sm text-gray-600">Total Labels:</div>
                  <div className="text-2xl font-bold text-blue-700">{totalLabels}</div>
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
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition"
            >
              Cancel
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
        </DialogPanel>
      </div>
    </Dialog>
  );
}
