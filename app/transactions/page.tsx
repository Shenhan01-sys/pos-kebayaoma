"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { transactions as dummyTx, formatRupiah, type Transaction } from "@/lib/dummy";
import {
  getAllTransactions,
  subscribeTransactions,
  setTransactionStatus,
} from "@/store/cart";

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
      <h1 className="mb-4 text-2xl font-bold">Transaksi</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari no. transaksi / pelanggan…"
        className="mb-3 w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
      />
      <div className="overflow-auto rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-beige text-left text-olive">
            <tr>
              <th className="p-3">No</th>
              <th className="p-3">Waktu</th>
              <th className="p-3">Kasir</th>
              <th className="p-3">Pelanggan</th>
              <th className="p-3">Metode</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t hover:bg-beige/40">
                <td className="p-3">
                  <Link href={`/verify/${t.id}`} className="text-apricot underline">
                    {t.number}
                  </Link>
                </td>
                <td className="p-3">{new Date(t.createdAt).toLocaleString("id-ID")}</td>
                <td className="p-3">{t.cashier}</td>
                <td className="p-3">{t.customerName ?? "—"}</td>
                <td className="p-3 uppercase">{t.paymentMethod}</td>
                <td className="p-3 text-right">{formatRupiah(t.total)}</td>
                <td className="p-3">
                  <span
                    className={`rounded px-1.5 ${
                      t.status === "paid"
                        ? "bg-green-100 text-green-700"
                        : t.status === "cancelled" || t.status === "refunded"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="p-3">
                  {t.status === "paid" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTransactionStatus(t.id, "cancelled")}
                        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => setTransactionStatus(t.id, "refunded")}
                        className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700"
                      >
                        Refund
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
