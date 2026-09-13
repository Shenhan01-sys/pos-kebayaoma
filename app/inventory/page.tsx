"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { formatRupiah } from "@/lib/dummy";
import { encodeVoBarcode } from "@/lib/barcode";
import { Icon } from "@/components/icons";
import PrintBarcodeModal from "@/components/PrintBarcodeModal";

type Reason = "Rusak/Hilang" | "Penyesuaian" | "Stok Opname" | "Lainnya";

export default function InventoryPage() {
  const { products, movements, vendors, adjustStock, addVendor } = useData();
  const auth = useAuth();
  const s = useSettings();
  const cashierName = auth.staff?.name ?? s.cashierName;
  const [stockOpen, setStockOpen] = useState<{ productId: string; productName: string; sku: string; current: number } | null>(null);
  const [mode, setMode] = useState<"in" | "out">("in");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<Reason>("Penyesuaian");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"stock" | "log">("stock");
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [printPreset, setPrintPreset] = useState<{ productId: string; variantId: string; copies: number; content: string; vendorName: string } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    useData.getState().fetchProducts();
    useData.getState().fetchMovements();
    useData.getState().fetchVendors();
  }, []);

  const active = products.filter((p) => p.active);
  const low = active.filter((p) => p.stock <= 5);

  function openStock(productId: string, productName: string, sku: string, current: number) {
    setStockOpen({ productId, productName, sku, current });
    setMode("in");
    setQty(1);
    setReason("Penyesuaian");
    setNote("");
    setBusy(false);
    setApplyError(null);
    setVendorId("");
    setNewVendor("");
    setUnitCost("");
    busyRef.current = false;
  }
  async function apply() {
    if (!stockOpen || qty <= 0 || busyRef.current) return; // AC-E2a#2: guard ref — state busy belum ter-render saat dobel-klik < 1 frame
    if (mode === "out" && qty > stockOpen.current) {
      const ok = confirm(
        `Stok ${stockOpen.productName} hanya ${stockOpen.current}, mau kurangi ${qty}? Kelebihan akan diabaikan (stok jadi 0).`
      );
      if (!ok) return;
    }
    if (mode === "in" && !vendorId && !newVendor.trim() && unitCost.trim()) {
      setApplyError("Pilih / tulis vendor dulu untuk menyimpan harga modal.");
      return;
    }
    const delta = mode === "in" ? qty : -qty;
    const type = mode === "in" ? "restock" : "adjustment";
    setBusy(true);
    busyRef.current = true;
    setApplyError(null);
    try {
      // E2: vendor baru inline → auto-insert ke daftar vendor
      let finalVendorId: string | null = vendorId || null;
      let finalVendorName = vendors.find((v) => v.id === vendorId)?.name ?? "";
      if (mode === "in" && newVendor.trim()) {
        const v = await addVendor(newVendor.trim());
        if (!v) {
          setApplyError(useData.getState().error ?? "Gagal menambah vendor.");
          return;
        }
        finalVendorId = v.id;
        finalVendorName = v.name;
      }
      const finalUnitCost = mode === "in" && unitCost.trim() ? Number(unitCost) : null;

      const ok = await adjustStock(stockOpen.productId, delta, type, cashierName, reason, note, finalVendorId, finalUnitCost);
      if (!ok) {
        setApplyError(useData.getState().error ?? "Gagal menyimpan penyesuaian stok.");
        return;
      }
      const closedProduct = stockOpen;
      setStockOpen(null);
      // AC-E2c#1: restock dengan vendor → auto-trigger print stiker barcode (qty = jumlah restock)
      if (mode === "in" && finalVendorId) {
        const prod = useData.getState().products.find((p) => p.id === closedProduct.productId);
        const v0 = prod?.variants[0];
        if (v0) {
          setPrintPreset({
            productId: closedProduct.productId,
            variantId: v0.id,
            copies: qty,
            // konten VO: varian (jika tunggal) agar scan langsung presisi; multi-varian → ref produk
            content: encodeVoBarcode(prod && prod.variants.length === 1 ? v0.id : closedProduct.productId, finalVendorId),
            vendorName: finalVendorName || newVendor.trim(),
          });
        }
      }
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  const newStock = stockOpen ? Math.max(0, stockOpen.current + (mode === "in" ? qty : -qty)) : 0;
  const vendorNameOf = (id?: string | null) => (id ? vendors.find((v) => v.id === id)?.name ?? "—" : null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Inventori & Stok</h1>
        <div className="seg">
          <button onClick={() => setTab("stock")} className={`seg-item ${tab === "stock" ? "seg-item-active" : ""}`}>Stok</button>
          <button onClick={() => setTab("log")} className={`seg-item ${tab === "log" ? "seg-item-active" : ""}`}>Riwayat</button>
        </div>
      </div>

      {tab === "stock" && (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-warning/10 px-3 py-2.5 text-sm font-medium text-warning">
            <Icon name="alert" size={16} /> {low.length} produk stok menipis (≤5)
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-beige/70 text-left text-olive">
                <tr>
                  <th className="p-3 font-semibold">Produk</th>
                  <th className="p-3 text-center font-semibold">Series</th>
                  <th className="p-3 text-right font-semibold">Stok</th>
                  <th className="p-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {active.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 hover:bg-beige/40">
                    <td className="p-3 font-medium text-ink">{p.name}</td>
                    <td className="p-3 text-center text-xs text-gray-600">{p.variants.length}</td>
                    <td className={`p-3 text-right font-bold tnum ${p.stock === 0 ? "text-danger" : p.stock <= 5 ? "text-warning" : ""}`}>{p.stock}</td>
                    <td className="p-3">
                      <button onClick={() => openStock(p.id, p.name, p.sku, p.stock)} className="btn-primary px-2.5 py-1 text-xs">
                        Restock / Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "log" && (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-beige/70 text-left text-olive">
              <tr>
                <th className="p-3 font-semibold">Waktu</th>
                <th className="p-3 font-semibold">Produk</th>
                <th className="p-3 font-semibold">Tipe</th>
                <th className="p-3 text-right font-semibold">Qty</th>
                <th className="p-3 font-semibold">Alasan</th>
                <th className="p-3 font-semibold">Vendor</th>
                <th className="p-3 text-right font-semibold">Modal/unit</th>
                <th className="p-3 font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr><td className="p-4 text-center text-gray-600" colSpan={8}>Belum ada pergerakan stok.</td></tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-black/5">
                  <td className="p-3 text-xs text-gray-600">{new Date(m.createdAt).toLocaleString("id-ID")}</td>
                  <td className="p-3 font-medium text-ink">{m.productName} <span className="text-gray-600">({m.sku})</span></td>
                  <td className="p-3"><span className="pill-muted">{m.type}</span></td>
                  <td className={`p-3 text-right font-bold tnum ${m.quantity < 0 ? "text-danger" : "text-success"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                  <td className="p-3">{m.reason ?? "—"}</td>
                  <td className="p-3">{vendorNameOf(m.vendorId) ?? "—"}</td>
                  <td className="p-3 text-right tnum">{m.unitCost != null ? formatRupiah(m.unitCost) : "—"}</td>
                  <td className="p-3">{m.staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stockOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-[380px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
            <h3 className="mb-1 text-lg font-bold text-ink">Stok: {stockOpen.productName}</h3>
            <p className="mb-4 text-xs text-gray-600">{stockOpen.sku} · stok saat ini: <span className="font-bold text-ink">{stockOpen.current}</span></p>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("in")}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                  mode === "in" ? "border-success bg-success/10 text-success" : "border-black/10 text-gray-600"
                }`}
              >
                <Icon name="plus" size={20} />
                <span className="text-sm font-bold">Tambah Stok</span>
              </button>
              <button
                onClick={() => setMode("out")}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                  mode === "out" ? "border-danger bg-danger/10 text-danger" : "border-black/10 text-gray-600"
                }`}
              >
                <Icon name="minus" size={20} />
                <span className="text-sm font-bold">Kurangi Stok</span>
              </button>
            </div>

            <label className="mb-1.5 block text-sm text-olive">Jumlah</label>
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-beige text-lg font-bold text-ink shadow-soft transition active:scale-95"
              >
                <Icon name="minus" size={18} />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="input flex-1 text-center text-xl font-bold tnum"
              />
              <button
                onClick={() => setQty((q) => q + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-beige text-lg font-bold text-ink shadow-soft transition active:scale-95"
              >
                <Icon name="plus" size={18} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl bg-beige/60 px-3 py-2.5 text-sm">
              <span className="text-gray-600">Stok setelah penyesuaian</span>
              <span className={`font-extrabold tnum ${newStock === 0 ? "text-danger" : "text-ink"}`}>{newStock}</span>
            </div>

            {mode === "in" && (
              <div className="mb-4 rounded-2xl bg-violet/5 p-3 ring-1 ring-violet/15">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-violet">
                  <Icon name="box" size={15} /> Vendor / Kulaan
                </div>
                <label className="mb-1 block text-xs text-olive">Vendor</label>
                <select
                  value={vendorId}
                  onChange={(e) => { setVendorId(e.target.value); setNewVendor(""); }}
                  className="input mb-2"
                  disabled={!!newVendor}
                >
                  <option value="">— pilih vendor (opsional) —</option>
                  {vendors.filter((v) => v.active).map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <label className="mb-1 block text-xs text-olive">atau vendor baru (auto tersimpan)</label>
                <input
                  value={newVendor}
                  onChange={(e) => { setNewVendor(e.target.value); if (e.target.value.trim()) setVendorId(""); }}
                  className="input mb-2"
                  placeholder="mis. Bu Tini"
                />
                <label className="mb-1 block text-xs text-olive">Harga modal / unit (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="input"
                  placeholder="mis. 45000"
                />
              </div>
            )}

            <label className="mb-1 block text-sm text-olive">Alasan</label>
            <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className="input mb-2">
              <option>Rusak/Hilang</option>
              <option>Penyesuaian</option>
              <option>Stok Opname</option>
              <option>Lainnya</option>
            </select>
            <label className="mb-1 block text-sm text-olive">Catatan</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input mb-4" />
            {applyError && (
              <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{applyError}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStockOpen(null)} disabled={busy} className="btn-ghost flex-1 disabled:opacity-40">Batal</button>
              <button onClick={apply} disabled={qty <= 0 || busy} className="btn-violet flex-1 disabled:opacity-40">{busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
      {printPreset && (
        <PrintBarcodeModal
          isOpen
          onClose={() => setPrintPreset(null)}
          productId={printPreset.productId}
          preset={{
            variantId: printPreset.variantId,
            copies: printPreset.copies,
            barcode: printPreset.content,
            vendorName: printPreset.vendorName,
          }}
        />
      )}
    </div>
  );
}
