"use client";

import { useState } from "react";
import { transactions as dummyTx, products, categories, formatRupiah } from "@/lib/dummy";
import { getAllTransactions } from "@/store/cart";

function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.join(",")).join("\n");
}
function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const all = getAllTransactions(dummyTx).filter((t) => t.status === "paid");
  const inRange = all.filter((t) => {
    const d = new Date(t.createdAt);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    return true;
  });

  const sales = inRange.reduce((s, t) => s + t.total, 0);
  const tax = inRange.reduce((s, t) => s + (t.tax ?? 0), 0);
  const discount = inRange.reduce((s, t) => s + (t.discount ?? 0), 0);
  const count = inRange.length;
  const avg = count ? sales / count : 0;

  const byMethod: Record<string, number> = {};
  inRange.forEach((t) => (byMethod[t.paymentMethod] = (byMethod[t.paymentMethod] ?? 0) + t.total));

  const byProduct: Record<string, { qty: number; rev: number }> = {};
  inRange.forEach((t) =>
    t.items.forEach((it) => {
      byProduct[it.name] = byProduct[it.name] ?? { qty: 0, rev: 0 };
      byProduct[it.name].qty += it.quantity;
      byProduct[it.name].rev += it.total;
    })
  );

  const maxMethod = Math.max(1, ...Object.values(byMethod));
  const maxProd = Math.max(1, ...Object.values(byProduct).map((v) => v.rev));

  function exportSales() {
    const rows: (string | number)[][] = [["No", "Waktu", "Kasir", "Pelanggan", "Metode", "Subtotal", "Diskon", "Pajak", "Total"]];
    inRange.forEach((t) =>
      rows.push([t.number, t.createdAt, t.cashier, t.customerName ?? "", t.paymentMethod, t.subtotal, t.discount, t.tax, t.total])
    );
    download("laporan-penjualan.csv", toCSV(rows));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Laporan</h1>
        <button onClick={exportSales} className="rounded-lg bg-olive px-3 py-2 text-sm font-bold text-beige">Export CSV</button>
      </div>

      <div className="mb-4 flex gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="inp w-auto" />
        <span className="self-center text-sm text-gray-500">s.d</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="inp w-auto" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total Penjualan", formatRupiah(sales)],
          ["Transaksi", String(count)],
          ["Rata-rata", formatRupiah(avg)],
          ["Pajak", formatRupiah(tax)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-white p-4 shadow">
            <div className="text-xs text-gray-500">{l}</div>
            <div className="mt-1 text-lg font-bold text-olive">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 font-bold">Per Metode Pembayaran</h2>
          {Object.entries(byMethod).map(([m, v]) => (
            <div key={m} className="mb-2">
              <div className="flex justify-between text-sm"><span className="uppercase">{m}</span><span>{formatRupiah(v)}</span></div>
              <div className="h-2 w-full rounded bg-beige"><div className="h-2 rounded bg-apricot" style={{ width: `${(v / maxMethod) * 100}%` }} /></div>
            </div>
          ))}
          {Object.keys(byMethod).length === 0 && <p className="text-sm text-gray-400">Tidak ada data.</p>}
        </div>

        <div className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 font-bold">Diskon Diberikan</h2>
          <div className="text-2xl font-bold text-olive">{formatRupiah(discount)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white p-4 shadow">
        <h2 className="mb-3 font-bold">Penjualan per Produk</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-olive">
            <tr><th className="py-1">Produk</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Revenue</th></tr>
          </thead>
          <tbody>
            {Object.entries(byProduct)
              .sort((a, b) => b[1].rev - a[1].rev)
              .map(([name, v]) => (
                <tr key={name} className="border-t">
                  <td className="py-1">{name}</td>
                  <td className="py-1 text-right">{v.qty}</td>
                  <td className="py-1 text-right font-semibold">{formatRupiah(v.rev)}</td>
                </tr>
              ))}
            {Object.keys(byProduct).length === 0 && (
              <tr><td className="py-1 text-gray-400">Tidak ada data.</td></tr>
            )}
          </tbody>
        </table>
        {Object.keys(byProduct).length > 0 && (
          <div className="mt-2">
            {Object.entries(byProduct).sort((a, b) => b[1].rev - a[1].rev).map(([name, v]) => (
              <div key={name} className="mb-1">
                <div className="h-1.5 w-full rounded bg-beige"><div className="h-1.5 rounded bg-olive" style={{ width: `${(v.rev / maxProd) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
