"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { transactions as dummyTx, formatRupiah, type Transaction } from "@/lib/dummy";
import { getAllTransactions, subscribeTransactions } from "@/store/cart";
import { useSettings } from "@/store/settings";
import { useData } from "@/store/data";

export default function DashboardPage() {
  const [live, setLive] = useState<Transaction[]>([]);
  const s = useSettings();
  const { products } = useData();
  useEffect(() => {
    const sync = () => setLive(getAllTransactions(dummyTx));
    sync();
    return subscribeTransactions(sync);
  }, []);

  const all = live;
  const sales = all.reduce((sum, t) => sum + (t.status === "paid" ? t.total : 0), 0);
  const count = all.filter((t) => t.status === "paid").length;

  const paid = all.filter((t) => t.status === "paid");
  const byMethod: Record<string, number> = {};
  paid.forEach((t) => {
    byMethod[t.paymentMethod] = (byMethod[t.paymentMethod] ?? 0) + t.total;
  });
  const maxMethod = Math.max(1, ...Object.values(byMethod));

  const top: Record<string, number> = {};
  paid.forEach((t) =>
    t.items.forEach((it) => {
      top[it.name] = (top[it.name] ?? 0) + it.quantity;
    })
  );
  const topProducts = Object.entries(top)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxTop = Math.max(1, ...topProducts.map(([, q]) => q));

  const lowStock = products
    .flatMap((p) => p.variants)
    .filter((v) => v.stock <= 5)
    .map((v) => ({ ...v, product: products.find((p) => p.variants.includes(v)) }));

  const cards = [
    { label: "Penjualan Hari Ini", value: formatRupiah(sales), href: "/transactions" },
    { label: "Transaksi", value: String(count), href: "/transactions" },
    { label: "Item Stok Menipis", value: String(lowStock.length), href: "/products" },
    { label: "Buka Kasir", value: "Mulai", href: "/pos" },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-4 text-sm text-olive">
        {s.storeName} · {s.address}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl bg-white p-4 shadow hover:ring-2 hover:ring-apricot"
          >
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="mt-1 text-xl font-bold text-olive">{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow lg:col-span-1">
          <h2 className="mb-3 font-bold">Pembayaran per Metode</h2>
          {Object.keys(byMethod).length === 0 && (
            <p className="text-sm text-gray-400">Belum ada penjualan.</p>
          )}
          {Object.entries(byMethod).map(([m, v]) => (
            <div key={m} className="mb-2">
              <div className="flex justify-between text-sm">
                <span className="uppercase">{m}</span>
                <span>{formatRupiah(v)}</span>
              </div>
              <div className="h-2 w-full rounded bg-beige">
                <div
                  className="h-2 rounded bg-apricot"
                  style={{ width: `${(v / maxMethod) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white p-4 shadow lg:col-span-1">
          <h2 className="mb-3 font-bold">Produk Terlaris</h2>
          {topProducts.length === 0 && (
            <p className="text-sm text-gray-400">Belum ada penjualan.</p>
          )}
          {topProducts.map(([name, q]) => (
            <div key={name} className="mb-2">
              <div className="flex justify-between text-sm">
                <span>{name}</span>
                <span>{q} pcs</span>
              </div>
              <div className="h-2 w-full rounded bg-beige">
                <div
                  className="h-2 rounded bg-olive"
                  style={{ width: `${(q / maxTop) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white p-4 shadow lg:col-span-1">
          <h2 className="mb-2 font-bold">Stok Menipis</h2>
          <ul className="space-y-1 text-sm">
            {lowStock.map((v) => (
              <li key={v.id} className="flex justify-between border-b py-1">
                <span>
                  {v.product?.name} — {v.size}/{v.color}
                </span>
                <span className={v.stock === 0 ? "text-red-600 font-bold" : "text-amber-600"}>
                  {v.stock}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white p-4 shadow">
        <h2 className="mb-2 font-bold">Transaksi Terakhir</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th>No</th>
              <th>Kasir</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {all.slice(0, 6).map((t) => (
              <tr key={t.id} className="border-t">
                <td>{t.number}</td>
                <td>{t.cashier}</td>
                <td>{formatRupiah(t.total)}</td>
                <td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
