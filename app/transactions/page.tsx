"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { transactions as dummyTx, formatRupiah, type Transaction } from "@/lib/dummy";
import {
  getAllTransactions,
  subscribeTransactions,
  setTransactionStatus,
} from "@/store/cart";
import { useAuth } from "@/store/auth";
import { Icon } from "@/components/icons";

export default function TransactionsPage() {
  const auth = useAuth();
  const canManage = auth.staff?.role === "manager" || auth.staff?.role === "admin" || !auth.staff;
  const [all, setAll] = useState<Transaction[]>([]);
  const [q, setQ] = useState("");
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ tx: Transaction; action: "cancelled" | "refunded" } | null>(null);

  useEffect(() => {
    const sync = () => setAll(getAllTransactions(dummyTx));
    sync();
    return subscribeTransactions(sync);
  }, []);

  const filtered = all.filter((t) =>
    q
      ? t.number.toLowerCase().includes(q.toLowerCase()) ||
        (t.customerName ?? "").toLowerCase().includes(q.toLowerCase())
      : true
  );

  function doConfirm() {
    if (!confirm) return;
    setTransactionStatus(confirm.tx.id, confirm.action);
    setConfirm(null);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-ink">Transaksi</h1>
      <div className="relative mb-3 max-w-sm">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari no. transaksi / pelanggan…"
          className="input pl-10"
        />
      </div>
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-beige/70 text-left text-olive">
            <tr>
              <th className="p-3 font-semibold">No</th>
              <th className="p-3 font-semibold">Waktu</th>
              <th className="p-3 font-semibold">Kasir</th>
              <th className="p-3 font-semibold">Pelanggan</th>
              <th className="p-3 font-semibold">Metode</th>
              <th className="p-3 text-right font-semibold">Total</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Bukti</th>
              <th className="p-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-black/5 hover:bg-beige/40">
                <td className="p-3">
                  <Link href={`/verify/${t.id}`} className="font-semibold text-apricot hover:underline">
                    {t.number}
                  </Link>
                </td>
                <td className="p-3 text-xs text-gray-600">{new Date(t.createdAt).toLocaleString("id-ID")}</td>
                <td className="p-3">{t.cashier}</td>
                <td className="p-3">{t.customerName ?? "—"}</td>
                <td className="p-3 uppercase text-gray-600">{t.paymentMethod}</td>
                <td className="p-3 text-right font-semibold tnum text-ink">{formatRupiah(t.total)}</td>
                <td className="p-3">
                  <span
                    className={
                      t.status === "paid" ? "pill-success" : t.status === "cancelled" || t.status === "refunded" ? "pill-danger" : "pill-warning"
                    }
                  >
                    {t.status}
                  </span>
                </td>
                <td className="p-3">
                  {t.photoProof ? (
                    <button
                      onClick={() => setPhotoView(t.photoProof!)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet/10 text-violet transition hover:bg-violet/20"
                      title="Lihat foto bukti"
                      aria-label="Lihat foto bukti"
                    >
                      <Icon name="photo" size={16} />
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="p-3">
                  {t.status === "paid" && canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => setConfirm({ tx: t, action: "cancelled" })} className="btn-danger px-2.5 py-1 text-xs">Batal</button>
                      <button onClick={() => setConfirm({ tx: t, action: "refunded" })} className="btn-soft px-2.5 py-1 text-xs">Refund</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="p-4 text-center text-gray-600" colSpan={9}>Tidak ada transaksi.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Photo proof viewer */}
      {photoView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPhotoView(null)}>
          <div className="relative max-h-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPhotoView(null)}
              className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-soft-lg"
              aria-label="Tutup"
            >
              <Icon name="close" size={18} />
            </button>
            <img src={photoView} alt="Bukti Pembayaran" className="max-h-[80vh] rounded-2xl shadow-soft-xl" />
          </div>
        </div>
      )}

      {/* Cancel / Refund confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-3xl bg-white p-5 text-center shadow-soft-xl">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger">
              <Icon name="alert" size={24} />
            </span>
            <h3 className="mb-1 text-lg font-bold text-ink">
              {confirm.action === "cancelled" ? "Batalkan Transaksi?" : "Refund Transaksi?"}
            </h3>
            <p className="mb-1 text-sm text-gray-600">
              {confirm.tx.number} · {formatRupiah(confirm.tx.total)}
            </p>
            <p className="mb-4 text-xs text-gray-500">
              {confirm.action === "cancelled"
                ? "Stok akan dikembalikan dan statistik pelanggan diperbarui."
                : "Stok akan dikembalikan dan statistik pelanggan diperbarui."}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="btn-ghost flex-1">Tidak</button>
              <button
                onClick={doConfirm}
                className={confirm.action === "cancelled" ? "btn-danger flex-1" : "btn-violet flex-1"}
              >
                Ya, {confirm.action === "cancelled" ? "Batalkan" : "Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
