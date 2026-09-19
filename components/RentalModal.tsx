"use client";

// components/RentalModal.tsx — E7: mulai sewa (tarif flat per seri + deposit, tgl kembali
// default = start + rental_days, penyewa auto-create di customers).

import { useState } from "react";
import { formatRupiah, type Product, type Variant } from "@/lib/dummy";
import { useData } from "@/store/data";
import { addDays, rentTotal } from "@/lib/rental";
import { Icon } from "@/components/icons";

export default function RentalModal({
  product,
  variant,
  cashierName,
  onClose,
}: {
  product: Product;
  variant: Variant;
  cashierName: string;
  onClose: () => void;
}) {
  const { activeStoreId, customers, createRental } = useData();
  const [qty, setQty] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(variant.rentalDays ?? 3);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const price = variant.rentalPrice ?? 0;
  const total = rentTotal(price, qty);
  const due = addDays(startDate, days);

  async function submit() {
    if (!activeStoreId) { setErr("Pilih toko operasional dulu."); return; }
    if (!name.trim()) { setErr("Nama penyewa wajib diisi."); return; }
    if (qty > product.stock) { setErr(`Stok hanya ${product.stock}.`); return; }
    setBusy(true);
    setErr(null);
    const txId = await createRental({
      storeId: activeStoreId,
      productId: product.id,
      variantId: variant.id,
      qty,
      rentPrice: price,
      deposit: variant.depositPrice ?? null,
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
    // E14: transactions tidak lagi di-load saat boot — fetch dulu agar nomor nota sewa terisi.
    await useData.getState().fetchTransactions();
    const tx = useData.getState().transactions.find((t) => t.id === txId);
    setDone(tx?.number ?? "Tersimpan");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-[400px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">Sewa: {product.name}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600" aria-label="Tutup">
            <Icon name="close" size={16} />
          </button>
        </div>

        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <Icon name="check" size={24} />
            </div>
            <p className="mb-1 font-bold text-ink">Sewa tercatat — nota {done}</p>
            <p className="mb-4 text-sm text-gray-600">
              Stok {product.name} sudah dikurangi; pengingat jatuh tempo {due} otomatis.
            </p>
            <button onClick={onClose} className="btn-primary w-full py-2.5">Selesai</button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-600">
              {variant.name} · {variant.size}/{variant.color} · sewa <b>{formatRupiah(price)}</b>/unit
              {variant.depositPrice ? <> · deposit {formatRupiah(variant.depositPrice)}/unit</> : null}
              {" "}· stok {product.stock}
            </p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Jumlah</span>
                <input type="number" min={1} max={product.stock} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="input" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Hari sewa</span>
                <input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="input" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Tanggal mulai</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-olive">Jatuh tempo</span>
                <div className="rounded-2xl bg-beige/60 px-3 py-2 font-semibold text-ink">{due}</div>
              </div>
            </div>
            <label className="mb-1 block text-sm text-olive">Nama penyewa</label>
            <input value={name} list="rental-customers" onChange={(e) => { setName(e.target.value); const c = customers.find((x) => x.name === e.target.value); if (c?.phone) setPhone(c.phone); }} className="input mb-2" placeholder="wajib" />
            <datalist id="rental-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <label className="mb-1 block text-sm text-olive">No. HP (untuk reminder)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input mb-3" inputMode="tel" placeholder="08xx…" />
            <div className="mb-3 rounded-2xl bg-violet/5 px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="text-olive">Total sewa</span><b className="tnum text-ink">{formatRupiah(total)}</b></div>
              {variant.depositPrice ? <div className="flex justify-between text-xs text-gray-600"><span>Deposit (uang fisik di buku)</span><span className="tnum">{formatRupiah(variant.depositPrice * qty)}</span></div> : null}
            </div>
            {err && <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
            <button onClick={submit} disabled={busy} className="btn-violet w-full py-3 disabled:opacity-50">
              {busy ? "Menyimpan…" : `Mulai Sewa — ${formatRupiah(total)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
