"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getProductBySku,
  categoryName,
  formatRupiah,
} from "@/lib/dummy";
import { useSettings } from "@/store/settings";
import { useState } from "react";

export default function ProductProfilePage({
  params,
}: {
  params: { sku: string };
}) {
  const product = getProductBySku(params.sku);
  const s = useSettings();
  const [img, setImg] = useState(0);
  if (!product) notFound();

  const minPrice = Math.min(...product.variants.map((v) => v.sellingPrice));

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="rounded-2xl bg-white p-5 shadow">
        <div className="text-xs text-apricot">{s.storeName}</div>
        <h1 className="text-xl font-bold">{product.name}</h1>
        <div className="text-xs text-gray-500">
          {product.sku} · {categoryName(product.categoryId)}
        </div>

        <div
          className="mt-3 flex h-56 items-center justify-center rounded-xl text-white"
          style={{ background: "#775533" }}
        >
          {product.images[img]?.split("text=")[1] ?? product.name}
        </div>
        {product.images.length > 1 && (
          <div className="mt-2 flex gap-2">
            {product.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setImg(i)}
                className={`h-12 flex-1 rounded-lg text-xs text-white ${
                  i === img ? "ring-2 ring-apricot" : ""
                }`}
                style={{ background: "#775533" }}
              >
                {im.split("text=")[1]}
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-sm text-gray-600">{product.description}</p>

        <div className="mt-3 flex flex-wrap gap-1">
          {product.tags.map((t) => (
            <span key={t} className="rounded-full bg-beige px-2 py-0.5 text-xs text-olive">
              #{t}
            </span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-beige p-2">
            <div className="text-gray-500">Bahan</div>
            <div>{product.fabric}</div>
          </div>
          <div className="rounded-lg bg-beige p-2">
            <div className="text-gray-500">Perawatan</div>
            <div>{product.care}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-gray-500 text-sm">Varian & Harga</div>
          <div className="mt-1 space-y-1">
            {product.variants.map((v) => (
              <div
                key={v.id}
                className="flex justify-between rounded-lg border p-2 text-sm"
              >
                <span>
                  {v.size} · {v.color}
                  {v.stock === 0 && (
                    <span className="ml-2 text-red-600">Habis</span>
                  )}
                </span>
                <span className="font-semibold">{formatRupiah(v.sellingPrice)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center text-2xl font-bold text-olive">
          {formatRupiah(minPrice)}
          <span className="text-sm font-normal text-gray-400"> ke atas</span>
        </div>

        <Link
          href="/pos"
          className="mt-3 block rounded-lg bg-apricot px-3 py-2 text-center font-bold text-white"
        >
          Tambah ke Kasir
        </Link>
        <p className="mt-2 text-center text-xs text-gray-400">
          Dipindai dari label QR {s.storeName}
        </p>
      </div>
    </div>
  );
}
