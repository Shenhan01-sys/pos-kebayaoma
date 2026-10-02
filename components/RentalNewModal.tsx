"use client";

// components/RentalNewModal.tsx — E17/E18: sewa baru dari halaman /sewa. "Mulai sewa" TIDAK menyimpan di sini: draft dibawa ke
// keranjang POS (/pos) → popup konfirmasi sewa → modal pembayaran yang sama dengan penjualan (QRIS/tunai/transfer + foto bukti).
// Langkah 1: pilih barang (semua varian bertok; yang belum punya Harga Sewa memakai DEFAULT persen dari
// harga jual — revisi 2). Langkah 2: harga sewa (bisa diubah, chip persen), data sewa & penyewa.
// Tarif flat per unit + deposit per unit; jatuh tempo = mulai + hari; penyewa auto-create.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, type Product, type Variant } from "@/lib/dummy";
import { useData } from "@/store/data";
import { useCart } from "@/store/cart";
import {
  DEFAULT_RENTAL_PCT,
  RENTAL_PCT_OPTIONS,
  addDays,
  buildRentalDraft,
  formatDateId,
  rentTotal,
  rentalPriceFromPct,
  resolveRentalPrice,
  validateRentalDraft,
} from "@/lib/rental";
import { Icon } from "@/components/icons";

interface Pick {
  product: Product;
  variant: Variant;
  /** harga sewa per unit awal (harga varian bila diatur, kalau tidak default persen) */
  price: number;
  /** true = harga sewa varian belum diatur → memakai default persen */
  isDefault: boolean;
}

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // tanggal LOKAL (bukan UTC)
};

export default function RentalNewModal({ onClose }: { onClose: () => void }) {
  const products = useData((s) => s.products);
  const customers = useData((s) => s.customers);
  const activeStoreId = useData((s) => s.activeStoreId);
  const router = useRouter();

  const [pick, setPick] = useState<Pick | null>(null);
  const [q, setQ] = useState("");
  const [qty, setQty] = useState(1);
  const [startDate, setStartDate] = useState(todayIso);
  const [days, setDays] = useState(3);
  const [price, setPrice] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Barang yang bisa disewa: SEMUA varian bertok. Harga sewa belum diatur → default persen dari harga jual
  // (varian tanpa harga jual & tanpa harga sewa tidak bisa dihitung → tidak ditampilkan).
  // Yang sudah diatur harga sewanya tampil lebih dulu.
  const rentable = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: Pick[] = [];
    for (const p of products) {
      if (p.stock <= 0) continue;
      for (const v of p.variants) {
        const r = resolveRentalPrice(v.sellingPrice, v.rentalPrice);
        if (r.price == null) continue;
        if (needle && !`${p.name} ${v.name} ${v.size} ${v.color}`.toLowerCase().includes(needle)) continue;
        out.push({ product: p, variant: v, price: r.price, isDefault: r.isDefault });
      }
    }
    out.sort((a, b) => Number(a.isDefault) - Number(b.isDefault) || a.product.name.localeCompare(b.product.name));
    return out;
  }, [products, q]);

  function choose(p: Pick) {
    setPick(p);
    setQty(1);
    setDays(p.variant.rentalDays ?? 3);
    setPrice(p.price);
    setErr(null);
  }

  function reset() {
    setPick(null);
    setName("");
    setPhone("");
    setErr(null);
    setStartDate(todayIso());
  }

  const deposit = pick?.variant.depositPrice ?? 0;
  const total = rentTotal(price, qty);
  const due = addDays(startDate, days);

  function submit() {
    if (!pick) return;
    if (!activeStoreId) { setErr("Pilih toko operasional (MJL/KTB) dulu."); return; }
    const draft = buildRentalDraft({
      productId: pick.product.id,
      variantId: pick.variant.id,
      qty,
      rentPrice: price,
      deposit: pick.variant.depositPrice ?? null,
      days,
      startDate,
      customerName: name,
      customerPhone: phone,
    });
    const problem = validateRentalDraft(draft, pick.product.stock);
    if (problem) { setErr(problem); return; }
    const cart = useCart.getState();
    if (cart.lines.length > 0 && !cart.rental) {
      const ok = confirm(`Keranjang POS sedang berisi ${cart.lines.length} item. Memulai sewa akan MENGOSONGKAN keranjang itu. Lanjutkan?`);
      if (!ok) return;
    }
    setErr(null);
    // E18: bawa draft ke keranjang POS; pembayaran di /pos lewat modal pembayaran yang sama
    cart.startRental(pick.product, pick.variant, draft);
    onClose();
    router.push("/pos");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{pick ? "Sewa baru" : "Pilih barang sewa"}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600" aria-label="Tutup">
            <Icon name="close" size={16} />
          </button>
        </div>

        {!pick ? (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input mb-3"
              placeholder="Cari barang / seri / ukuran / warna…"
              autoFocus
            />
            <div className="min-h-0 flex-1 space-y-2 overflow-auto pretty-scroll">
              {rentable.length === 0 && (
                <p className="rounded-2xl bg-beige/60 px-3 py-4 text-center text-sm text-gray-600">
                  {q ? "Tidak ada barang yang cocok." : "Tidak ada barang bertok dengan harga jual terisi. Cek Produk / Inventori."}
                </p>
              )}
              {rentable.map((p) => (
                <button
                  key={p.variant.id}
                  onClick={() => choose(p)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-beige/60 p-3 text-left transition hover:bg-beige"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{p.product.name}</div>
                    <div className="truncate text-xs text-gray-600">
                      {[p.variant.name, p.variant.size, p.variant.color].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-gray-600">
                      stok {p.product.stock} · {p.variant.rentalDays ?? 3} hari
                      {p.variant.depositPrice ? ` · deposit ${formatRupiah(p.variant.depositPrice)}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tnum text-sm font-bold text-olive">{formatRupiah(p.price)}</div>
                    <div className="text-[10px] text-gray-500">/unit</div>
                    {p.isDefault && <div className="text-[10px] font-semibold text-warning">default {DEFAULT_RENTAL_PCT}%</div>}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto pretty-scroll">
            <div className="mb-3 flex items-start justify-between gap-2 rounded-2xl bg-beige/60 p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{pick.product.name}</div>
                <div className="truncate text-xs text-gray-600">
                  {[pick.variant.name, pick.variant.size, pick.variant.color].filter(Boolean).join(" · ")} · stok {pick.product.stock}
                </div>
              </div>
              <button onClick={() => setPick(null)} className="shrink-0 text-xs font-semibold text-violet underline">Ganti</button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Jumlah</span>
                <input type="number" min={1} max={pick.product.stock} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="input" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Lama sewa (hari)</span>
                <input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="input" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Tanggal mulai</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || todayIso())} className="input" />
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-olive">Harus kembali</span>
                <div className="rounded-2xl bg-beige/60 px-3 py-2.5 font-semibold text-ink">{formatDateId(due)}</div>
              </div>
            </div>

            <div className="mb-3 rounded-2xl bg-beige/40 p-3">
              <label className="mb-1 block text-sm text-olive">Harga sewa per unit (Rp)</label>
              <input
                type="number"
                min={500}
                value={price || ""}
                onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
                className="input mb-2"
                aria-label="Harga sewa per unit"
              />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-medium text-olive">dari harga jual {formatRupiah(pick.variant.sellingPrice)}:</span>
                {RENTAL_PCT_OPTIONS.map((pct) => {
                  const v = rentalPriceFromPct(pick.variant.sellingPrice, pct);
                  const active = v != null && v === price;
                  return (
                    <button
                      key={pct}
                      type="button"
                      disabled={v == null}
                      aria-pressed={active}
                      onClick={() => v != null && setPrice(v)}
                      className={`rounded-full px-2.5 py-1 font-semibold transition disabled:opacity-40 ${active ? "bg-violet text-white" : "bg-black/5 text-ink hover:bg-black/10"}`}
                    >
                      {pct}%
                    </button>
                  );
                })}
                {!pick.isDefault && pick.price !== price && (
                  <button type="button" onClick={() => setPrice(pick.price)} className="rounded-full px-2.5 py-1 text-violet hover:bg-violet/10">
                    Harga produk ({formatRupiah(pick.price)})
                  </button>
                )}
              </div>
              {pick.isDefault && (
                <p className="mt-1.5 text-[11px] text-warning">
                  Harga sewa produk ini belum diatur — memakai default {DEFAULT_RENTAL_PCT}% dari harga jual. Ubah di sini atau atur permanen di Produk → Edit.
                </p>
              )}
            </div>

            <label className="mb-1 block text-sm text-olive">Nama penyewa</label>
            <input
              value={name}
              list="rental-customers"
              onChange={(e) => {
                setName(e.target.value);
                const c = customers.find((x) => x.name === e.target.value);
                if (c?.phone) setPhone(c.phone);
              }}
              className="input mb-2"
              placeholder="wajib"
            />
            <datalist id="rental-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <label className="mb-1 block text-sm text-olive">No. HP / WhatsApp</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input mb-3" inputMode="tel" placeholder="08xx… (untuk pengingat)" />

            <div className="mb-3 space-y-1 rounded-2xl bg-violet/5 px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="text-olive">Biaya sewa ({qty} × {formatRupiah(price)})</span><b className="tnum text-ink">{formatRupiah(total)}</b></div>
              {deposit > 0 && (
                <div className="flex justify-between text-xs text-gray-600"><span>Deposit ditahan ({qty} × {formatRupiah(deposit)}) — dicatat di buku</span><span className="tnum">{formatRupiah(deposit * qty)}</span></div>
              )}
              <div className="flex justify-between text-xs text-gray-600"><span>Pembayaran</span><span>di kasir (POS): QRIS / tunai / transfer</span></div>
            </div>
            {err && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
            <button onClick={submit} className="btn-violet w-full py-3">
              {`Mulai sewa — ${formatRupiah(total)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
