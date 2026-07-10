"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySku, categoryName, formatRupiah } from "@/lib/dummy";
import { useSettings } from "@/store/settings";
import { useState } from "react";
import { Icon } from "@/components/icons";

export default function ProductProfilePage({ params }: { params: { sku: string } }) {
  const product = getProductBySku(params.sku);
  const s = useSettings();
  const [img, setImg] = useState(0);
  if (!product) notFound();

  const minPrice = Math.min(...product.variants.map((v) => v.sellingPrice));
  const label = (src: string) => src.split("text=")[1] ?? product.name;

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="card card-pad">
        <div className="text-xs font-semibold text-apricot">{s.storeName}</div>
        <h1 className="text-xl font-extrabold text-ink">{product.name}</h1>
        <div className="text-xs text-gray-600">
          {product.sku} · {categoryName(product.categoryId)}
        </div>

        <div className="mt-3 flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-grad-olive text-center text-white shadow-soft">
          <span className="px-4 text-lg font-bold drop-shadow">{label(product.images[img] ?? product.name)}</span>
        </div>
        {product.images.length > 1 && (
          <div className="mt-2 flex gap-2">
            {product.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setImg(i)}
                className={`h-12 flex-1 rounded-xl text-xs font-medium text-white transition ${
                  i === img ? "bg-grad-olive ring-2 ring-apricot" : "bg-olive/70"
                }`}
              >
                {label(im)}
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-sm text-gray-600">{product.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.tags.map((t) => (
            <span key={t} className="pill-muted">#{t}</span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-beige/60 p-3">
            <div className="text-xs text-gray-600">Bahan</div>
            <div className="font-medium text-ink">{product.fabric}</div>
          </div>
          <div className="rounded-2xl bg-beige/60 p-3">
            <div className="text-xs text-gray-600">Perawatan</div>
            <div className="font-medium text-ink">{product.care}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 text-sm font-medium text-gray-600">Varian & Harga</div>
          <div className="space-y-1.5">
            {product.variants.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-2xl border border-black/5 bg-beige/50 p-2.5 text-sm">
                <span className="text-ink">
                  {v.size} · {v.color}
                  {v.stock === 0 && <span className="pill-danger ml-2">Habis</span>}
                </span>
                <span className="font-semibold tnum text-olive">{formatRupiah(v.sellingPrice)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center text-2xl font-extrabold text-olive tnum">
          {formatRupiah(minPrice)}
          <span className="text-sm font-normal text-gray-500"> ke atas</span>
        </div>

        <Link href="/pos" className="btn-primary mt-3 w-full py-3">
          <Icon name="pos" size={18} /> Tambah ke Kasir
        </Link>
        <p className="mt-2 text-center text-xs text-gray-500">
          Dipindai dari label QR {s.storeName}
        </p>
      </div>
    </div>
  );
}
