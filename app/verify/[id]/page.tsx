"use client";

import { useEffect, useState } from "react";
import { transactions as dummyTx, formatRupiah, type Transaction } from "@/lib/dummy";
import { getAllTransactions, subscribeTransactions } from "@/store/cart";

export default function VerifyPage({ params }: { params: { id: string } }) {
  const [tx, setTx] = useState<Transaction | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setTx(getAllTransactions(dummyTx).find((t) => t.id === params.id) ?? null);
    sync();
    return subscribeTransactions(sync);
  }, [params.id]);

  if (tx === undefined) return <div className="p-6">Memverifikasi…</div>;

  if (tx === null)
    return (
      <div className="mx-auto max-w-md p-6 text-center text-red-600">
        Transaksi tidak ditemukan.
      </div>
    );

  const paid = tx.paymentStatus === "paid";

  return (
    <div className="mx-auto max-w-md p-4">
      <div
        className={`rounded-2xl p-5 text-center shadow ${
          paid ? "bg-green-50" : "bg-amber-50"
        }`}
      >
        <div className="text-3xl">{paid ? "✅" : "⏳"}</div>
        <h1 className="mt-2 text-lg font-bold">
          {paid ? "Pembayaran Terverifikasi" : "Menunggu Pembayaran"}
        </h1>
        <div className="mt-1 text-sm text-gray-600">{tx.number}</div>
      </div>

      <div className="mt-3 rounded-xl bg-white p-4 shadow">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Tanggal</span>
          <span>{new Date(tx.createdAt).toLocaleString("id-ID")}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Kasir</span>
          <span>{tx.cashier}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Metode</span>
          <span className="uppercase">{tx.paymentMethod}</span>
        </div>
        <div className="mt-2 border-t pt-2">
          {tx.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {it.name} ({it.size}/{it.color}) x{it.quantity}
              </span>
              <span>{formatRupiah(it.total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-bold">
          <span>Total</span>
          <span className="text-brand-700">{formatRupiah(tx.total)}</span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">
        Verifikasi resmi Kebaya Oma
      </p>
    </div>
  );
}
