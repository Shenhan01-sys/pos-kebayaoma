"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { transactions as dummyTx, formatRupiah, type Transaction } from "@/lib/dummy";
import {
  getAllTransactions,
  subscribeTransactions,
  setTransactionStatus,
} from "@/store/cart";
import { Icon } from "@/components/icons";

export default function TransactionsPage() {
  const [all, setAll] = useState<Transaction[]>([]);
  const [q, setQ] = useState("");
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
                  {t.status === "paid" && (
                    <div className="flex gap-1">
                      <button onClick={() => setTransactionStatus(t.id, "cancelled")} className="btn-danger px-2.5 py-1 text-xs">Batal</button>
                      <button onClick={() => setTransactionStatus(t.id, "refunded")} className="btn-soft px-2.5 py-1 text-xs">Refund</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="p-4 text-center text-gray-600" colSpan={8}>Tidak ada transaksi.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
