"use client";

import { useEffect, useState } from "react";
import { transactions as dummyTx, formatRupiah, type Transaction } from "@/lib/dummy";
import { getAllTransactions, subscribeTransactions } from "@/store/cart";
import { Icon } from "@/components/icons";

export default function VerifyPage({ params }: { params: { id: string } }) {
  const [tx, setTx] = useState<Transaction | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setTx(getAllTransactions(dummyTx).find((t) => t.id === params.id) ?? null);
    sync();
    return subscribeTransactions(sync);
  }, [params.id]);

  if (tx === undefined) return <div className="p-6 text-center text-gray-500">Memverifikasi…</div>;

  if (tx === null)
    return (
      <div className="mx-auto max-w-md p-6 text-center text-danger">
        <Icon name="alert" size={32} className="mx-auto" />
        <p className="mt-2">Transaksi tidak ditemukan.</p>
      </div>
    );

  const paid = tx.paymentStatus === "paid";

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="card card-pad text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            paid ? "bg-success/15 text-success" : "bg-apricot/15 text-apricot"
          }`}
        >
          <Icon name={paid ? "check" : "transactions"} size={30} />
        </div>
        <h1 className="mt-3 text-lg font-extrabold text-ink">
          {paid ? "Pembayaran Terverifikasi" : "Menunggu Pembayaran"}
        </h1>
        <div className="mt-1 text-sm text-gray-500">{tx.number}</div>
      </div>

      <div className="card card-pad mt-3">
        <Row label="Tanggal" value={new Date(tx.createdAt).toLocaleString("id-ID")} />
        <Row label="Kasir" value={tx.cashier} />
        <Row label="Metode" value={tx.paymentMethod.toUpperCase()} />
        <div className="mt-2 space-y-1 border-t border-black/5 pt-2">
          {tx.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-ink">
                {it.name} <span className="text-gray-500">({it.size}/{it.color}) x{it.quantity}</span>
              </span>
              <span className="font-medium tnum">{formatRupiah(it.total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-black/5 pt-2 text-base font-extrabold">
          <span>Total</span>
          <span className="text-olive tnum">{formatRupiah(tx.total)}</span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">
        Verifikasi resmi Kebaya Oma
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
