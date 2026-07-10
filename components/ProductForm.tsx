"use client";

import { useState } from "react";
import { useData } from "@/store/data";
import { type Product, type Variant } from "@/lib/dummy";
import { Icon } from "@/components/icons";

let vid = 5000;
const newVid = () => `nv${++vid}`;

export default function ProductForm({
  product,
  onSaved,
}: {
  product?: Product;
  onSaved: () => void;
}) {
  const { categories, addProduct, updateProduct } = useData();
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? categories[0]?.id ?? ""
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [fabric, setFabric] = useState(product?.fabric ?? "");
  const [care, setCare] = useState(product?.care ?? "");
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [season, setSeason] = useState("");
  const [brand, setBrand] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [active, setActive] = useState(product?.active ?? true);
  const [variants, setVariants] = useState<Variant[]>(
    product?.variants ?? [
      {
        id: newVid(),
        sku: "",
        size: "S",
        color: "",
        colorCode: "#775533",
        stock: 0,
        costPrice: 0,
        sellingPrice: 0,
        barcode: "",
      },
    ]
  );

  function setVar(i: number, patch: Partial<Variant>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function submit() {
    const base = {
      name,
      sku,
      categoryId,
      description,
      fabric,
      care,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      active,
      images: [`https://placehold.co/400x500/775533/ffffff?text=${encodeURIComponent(name)}`],
    };
    if (product) {
      updateProduct(product.id, { ...base, variants });
    } else {
      addProduct({ ...base, variants });
    }
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Nama Produk">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Labeled>
        <Labeled label="SKU">
          <input value={sku} onChange={(e) => setSku(e.target.value)} className="input" />
        </Labeled>
        <Labeled label="Kategori">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Brand / Season">
          <input value={`${brand} ${season}`} onChange={(e) => { const [b, ...s] = e.target.value.split(" "); setBrand(b); setSeason(s.join(" ")); }} className="input" placeholder="Brand Season" />
        </Labeled>
        <Labeled label="Bahan">
          <input value={fabric} onChange={(e) => setFabric(e.target.value)} className="input" />
        </Labeled>
        <Labeled label="Perawatan">
          <input value={care} onChange={(e) => setCare(e.target.value)} className="input" />
        </Labeled>
        <Labeled label="Tags (pisah koma)">
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" />
        </Labeled>
        <Labeled label="Harga Coret (compare-at)">
          <input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} className="input" placeholder="opsional" />
        </Labeled>
      </div>
      <Labeled label="Deskripsi">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
      </Labeled>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-olive">Varian (ukuran / warna)</span>
          <button
            onClick={() =>
              setVariants((vs) => [
                ...vs,
                { id: newVid(), sku: "", size: "", color: "", colorCode: "#775533", stock: 0, costPrice: 0, sellingPrice: 0, barcode: "" },
              ])
            }
            className="btn-soft px-3 py-1.5 text-xs"
          >
            <Icon name="plus" size={14} /> Varian
          </button>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={v.id} className="grid grid-cols-2 gap-2 rounded-2xl bg-beige/60 p-3 text-xs sm:grid-cols-4">
              <input className="input" placeholder="Size" value={v.size} onChange={(e) => setVar(i, { size: e.target.value })} />
              <input className="input" placeholder="Warna" value={v.color} onChange={(e) => setVar(i, { color: e.target.value })} />
              <input className="input" placeholder="SKU" value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} />
              <input className="input" placeholder="Barcode" value={v.barcode ?? ""} onChange={(e) => setVar(i, { barcode: e.target.value })} />
              <input className="input" type="number" placeholder="Modal" value={v.costPrice} onChange={(e) => setVar(i, { costPrice: Number(e.target.value) })} />
              <input className="input" type="number" placeholder="Harga" value={v.sellingPrice} onChange={(e) => setVar(i, { sellingPrice: Number(e.target.value) })} />
              <input className="input" type="number" placeholder="Stok" value={v.stock} onChange={(e) => setVar(i, { stock: Number(e.target.value) })} />
              <button onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} className="btn-danger px-2 py-1.5 text-xs">
                Hapus
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Produk aktif (tampil di kasir & profil)
      </label>

      <button onClick={submit} className="btn-violet w-full py-3 text-base">
        {product ? "Simpan Perubahan" : "Tambah Produk"}
      </button>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-0.5 text-xs text-olive">{label}</div>
      {children}
    </label>
  );
}
