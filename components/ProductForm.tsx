"use client";

import { useState } from "react";
import { useData } from "@/store/data";
import { type Product, type Variant } from "@/lib/dummy";
import { Icon } from "@/components/icons";
import { takenCodes, ensureProductSku, fillVariantSkus } from "@/lib/sku";

let vid = 5000;
const newVid = () => `nv${++vid}`;

export default function ProductForm({
  product,
  onSaved,
}: {
  product?: Product;
  onSaved: () => void;
}) {
  const { categories, addProduct, updateProduct, vendors, addVendor, products } = useData();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? categories[0]?.id ?? ""
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [fabric, setFabric] = useState(product?.fabric ?? "");
  const [care, setCare] = useState(product?.care ?? "");
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [season, setSeason] = useState(product?.season ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [compareAt, setCompareAt] = useState(product?.compareAt ? String(product.compareAt) : "");
  const [active, setActive] = useState(product?.active ?? true);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [variants, setVariants] = useState<Variant[]>(
    product?.variants ?? [
      {
        id: newVid(),
        sku: "",
        name: "",
        size: "S",
        color: "",
        colorCode: "#775533",
        costPrice: 0,
        sellingPrice: 0,
        barcode: "",
      },
    ]
  );

  function setVar(i: number, patch: Partial<Variant>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function submit() {
    if (saving) return; // cegah klik ganda → produk dobel
    setFormError(null);
    if (!name.trim()) {
      setFormError("Nama produk wajib diisi.");
      return;
    }
    if (variants.length === 0) {
      setFormError("Minimal satu varian.");
      return;
    }
    setSaving(true);
    try {
      await save();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    // E2: vendor (pilih / tulis baru → auto-insert) + modal/unit utk seed stok awal
    let finalVendorId = vendorId || null;
    if (!product && newVendor.trim()) {
      const v = await addVendor(newVendor.trim());
      if (!v) {
        setFormError(useData.getState().error ?? "Gagal menyimpan vendor.");
        return;
      }
      finalVendorId = v.id;
    }
    // E16: SKU otomatis & unik (kolom SKU dihapus dari form). SKU lama yang unik dipertahankan.
    const others = takenCodes(products, (p) => p.id === product?.id);
    const productSku = ensureProductSku(sku, others);
    others.add(productSku);
    const variantsFilled = fillVariantSkus(variants, others);
    const base = {
      name: name.trim(),
      sku: productSku,
      categoryId,
      description,
      fabric,
      care,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      season,
      brand,
      compareAt: compareAt ? Number(compareAt) : undefined,
      active,
      stock,
      images: [`https://placehold.co/400x500/775533/ffffff?text=${encodeURIComponent(name)}`],
    };
    // E16: TUNGGU hasil simpan. Dulu addProduct tidak di-await lalu form langsung ditutup → bila gagal
    // (mis. 409) semua isian "hilang" tanpa pesan dan produk tidak tersimpan.
    useData.setState({ error: null });
    let ok = true;
    if (product) {
      await updateProduct(product.id, { ...base, variants: variantsFilled });
      ok = !useData.getState().error;
    } else {
      ok = await addProduct({
        ...base,
        variants: variantsFilled,
        seed: stock,
        vendorId: finalVendorId,
        unitCost: unitCost.trim() ? Number(unitCost) : null,
      } as Parameters<typeof addProduct>[0] & { seed: number; vendorId: string | null; unitCost: number | null });
    }
    if (!ok) {
      setFormError(useData.getState().error ?? "Gagal menyimpan produk.");
      return; // form tetap terbuka — isian tidak hilang
    }
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Nama Produk">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Labeled>
        {/* E16: SKU tidak diisi manual lagi — dibuat otomatis (8 digit, unik) saat simpan */}
        {product && (
          <Labeled label="Kode produk (otomatis)">
            <div className="input bg-black/5 text-gray-600">{sku || "—"}</div>
          </Labeled>
        )}
        <Labeled label="Kategori">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Brand">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} className="input" placeholder="mis. Batik Lestari" />
        </Labeled>
        <Labeled label="Season">
          <input value={season} onChange={(e) => setSeason(e.target.value)} className="input" placeholder="mis. 2026" />
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
          <input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} className="input" placeholder="opsional" type="number" />
        </Labeled>
        <Labeled label="Stok">
          <input value={stock} onChange={(e) => setStock(Number(e.target.value))} className="input" type="number" />
        </Labeled>
        {!product && (
          <>
            <Labeled label="Vendor (asal kulaan)">
              <div className="space-y-1.5">
                <select
                  value={vendorId}
                  onChange={(e) => { setVendorId(e.target.value); setNewVendor(""); }}
                  className="input"
                  disabled={!!newVendor}
                >
                  <option value="">— pilih vendor (opsional) —</option>
                  {vendors.filter((v) => v.active).map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <input
                  value={newVendor}
                  onChange={(e) => { setNewVendor(e.target.value); if (e.target.value.trim()) setVendorId(""); }}
                  className="input"
                  placeholder="atau tulis vendor baru…"
                />
              </div>
            </Labeled>
            <Labeled label="Harga modal / unit (Rp)">
              <input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="input" type="number" min={0} placeholder="mis. 45000" />
            </Labeled>
          </>
        )}
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
                { id: newVid(), sku: "", name: "", size: "", color: "", colorCode: "#775533", costPrice: 0, sellingPrice: 0, barcode: "" },
              ])
            }
            className="btn-soft px-3 py-1.5 text-xs"
          >
            <Icon name="plus" size={14} /> Varian
          </button>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={v.id} className="rounded-2xl bg-beige/60 p-3 text-xs">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <VarInput label="Nama Seri" value={v.name} onChange={(val) => setVar(i, { name: val })} />
                <VarInput label="Size" value={v.size} onChange={(val) => setVar(i, { size: val })} />
                <VarInput label="Warna" value={v.color} onChange={(val) => setVar(i, { color: val })} />
                {v.sku && (
                  <label className="block">
                    <div className="mb-0.5 text-[10px] font-medium text-olive">Kode (otomatis)</div>
                    <div className="input bg-black/5 text-gray-600">{v.sku}</div>
                  </label>
                )}
                <VarInput label="Barcode (opsional)" value={v.barcode ?? ""} onChange={(val) => setVar(i, { barcode: val })} />
                <VarInput label="Modal (Rp)" type="number" value={String(v.costPrice)} onChange={(val) => setVar(i, { costPrice: Number(val) })} />
                <VarInput label="Harga Jual (Rp)" type="number" value={String(v.sellingPrice)} onChange={(val) => setVar(i, { sellingPrice: Number(val) })} />
                <VarInput label="Harga Sewa (Rp)" type="number" value={String(v.rentalPrice ?? "")} onChange={(val) => setVar(i, { rentalPrice: val ? Number(val) : null })} />
                <VarInput label="Hari Sewa" type="number" value={String(v.rentalDays ?? 3)} onChange={(val) => setVar(i, { rentalDays: Number(val) || 3 })} />
                <VarInput label="Deposit (Rp)" type="number" value={String(v.depositPrice ?? "")} onChange={(val) => setVar(i, { depositPrice: val ? Number(val) : null })} />
                <div className="flex items-end">
                  <button onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} className="btn-danger w-full px-2 py-1.5">
                    Hapus
                  </button>
                </div>
              </div>
 {v.costPrice > 0 && v.sellingPrice > 0 && (
 <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-600">
 <span>Untung: <b className="text-olive">Rp {(v.sellingPrice - v.costPrice).toLocaleString("id-ID")}</b></span>
 <span>·</span>
 <span>{Math.round(((v.sellingPrice - v.costPrice) / v.costPrice) * 100)}% dari modal</span>
 </div>
 )}
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Produk aktif (tampil di kasir & profil)
      </label>

      {formError && (
        <div role="alert" className="rounded-2xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {formError}
        </div>
      )}
      <button onClick={submit} disabled={saving} className="btn-violet w-full py-3 text-base disabled:opacity-60">
        {saving ? "Menyimpan…" : product ? "Simpan Perubahan" : "Tambah Produk"}
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

function VarInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-0.5 text-[10px] font-medium text-olive">{label}</div>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
