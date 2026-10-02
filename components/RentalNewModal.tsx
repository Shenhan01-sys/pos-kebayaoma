"use client";

// components/RentalNewModal.tsx — E17: sewa baru dari halaman /sewa (menggantikan RentalModal di POS).
// Langkah 1: pilih barang (hanya varian ber-harga sewa & stok ada). Langkah 2: data sewa & penyewa.
// Tarif flat per unit + deposit per unit dari varian; jatuh tempo = mulai + hari; penyewa auto-create.

import { useMemo, useState } from "react";
import { formatRupiah, type Product, type Variant } from "@/lib/dummy";
import { useData } from "@/store/data";
import { addDays, formatDateId, rentTotal } from "@/lib/rental";
import { Icon } from "@/components/icons";

interface Pick {
  product: Product;
  variant: Variant;
}

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // tanggal LOKAL (bukan UTC)
};

export default function RentalNewModal({
  cashierName,
  onClose,
}: {
  cashierName: string;
  onClose: () => void;
}) {
  const products = useData((s) => s.products);
  const customers = useData((s) => s.customers);
  const activeStoreId = useData((s) => s.activeStoreId);
  const createRental = useData((s) => s.createRental);

  const [pick, setPick] = useState<Pick | null>(null);
  const [q, setQ] = useState("");
  const [qty, setQty] = useState(1);
  const [startDate, setStartDate] = useState(todayIso);
  const [days, setDays] = useState(3);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: string; item: string; due: string } | null>(null);

  // Barang yang bisa disewa: varian ber-harga sewa, stok produk > 0
  const rentable = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: Pick[] = [];
    for (const p of products) {
      if (p.stock <= 0) continue;
      for (const v of p.variants) {
        if ((v.rentalPrice ?? 0) <= 0) continue;
        if (needle && !`${p.name} ${v.name} ${v.size} ${v.color}`.toLowerCase().includes(needle)) continue;
        out.push({ product: p, variant: v });
      }
    }
    return out;
  }, [products, q]);

  function choose(p: Pick) {
    setPick(p);
    setQty(1);
    setDays(p.variant.rentalDays ?? 3);
    setErr(null);
  }

  function reset() {
    setPick(null);
    setDone(null);
    setName("");
    setPhone("");
    setErr(null);
    setStartDate(todayIso());
  }

  const price = pick?.variant.rentalPrice ?? 0;
  const deposit = pick?.variant.depositPrice ?? 0;
  const total = rentTotal(price, qty);
  const due = addDays(startDate, days);

  async function submit() {
    if (!pick) return;
    if (!activeStoreId) { setErr("Pilih toko operasional (MJL/KTB) dulu."); return; }
    if (!name.trim()) { setErr("Nama penyewa wajib diisi."); return; }
    if (qty > pick.product.stock) { setErr(`Stok hanya ${pick.product.stock}.`); return; }
    if (busy) return; // cegah klik ganda → sewa dobel
    setBusy(true);
    setErr(null);
    const txId = await createRental({
      storeId: activeStoreId,
      productId: pick.product.id,
      variantId: pick.variant.id,
      qty,
      rentPrice: price,
      deposit: pick.variant.depositPrice ?? null,
      startDate,
      days,
      customerName: name.trim(),
      customerPhone: phone.trim() || null,
      cashier: cashierName,
      paymentMethod: "cash",
    });
    setBusy(false);
    if (!txId) {
      setErr(useData.getState().error ?? "Gagal menyimpan sewa.");
      return;
    }
    // E14: transactions tidak di-load saat boot — fetch dulu agar nomor nota terisi.
    await useData.getState().fetchTransactions();
    const tx = useData.getState().transactions.find((t) => t.id === txId);
    setDone({ number: tx?.number ?? "tersimpan", item: `${pick.product.name} ×${qty}`, due });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{pick && !done ? "Sewa baru" : done ? "Sewa tercatat" : "Pilih barang sewa"}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600" aria-label="Tutup">
            <Icon name="close" size={16} />
          </button>
        </div>

        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <Icon name="check" size={24} />
            </div>
            <p className="mb-1 font-bold text-ink">Nota {done.number}</p>
            <p className="mb-1 text-sm text-gray-700">{done.item}</p>
            <p className="mb-4 text-sm text-gray-600">
              Stok sudah dikurangi · harus kembali <b>{formatDateId(done.due)}</b>.
            </p>
            <div className="flex gap-2">
              <button onClick={reset} className="btn-violet flex-1 py-2.5">Sewa lagi</button>
              <button onClick={onClose} className="btn-primary flex-1 py-2.5">Selesai</button>
            </div>
          </div>
        ) : !pick ? (
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
                  {q ? "Tidak ada barang yang cocok." : "Belum ada barang yang bisa disewa. Isi Harga Sewa di Produk → Edit → Varian."}
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
                    <div className="tnum text-sm font-bold text-olive">{formatRupiah(p.variant.rentalPrice ?? 0)}</div>
                    <div className="text-[10px] text-gray-500">/unit</div>
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
              <div className="flex justify-between text-xs text-gray-600"><span>Pembayaran</span><span>Tunai, lunas di muka</span></div>
            </div>
            {err && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
            <button onClick={submit} disabled={busy} className="btn-violet w-full py-3 disabled:opacity-50">
              {busy ? "Menyimpan…" : `Mulai sewa — ${formatRupiah(total)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
