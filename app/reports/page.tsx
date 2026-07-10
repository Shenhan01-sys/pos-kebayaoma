"use client";

import { useState } from "react";
import { transactions as dummyTx, formatRupiah } from "@/lib/dummy";
import { getAllTransactions } from "@/store/cart";
import { Icon, type IconName } from "@/components/icons";
import EChart from "@/components/EChart";
import type { EChartsOption } from "echarts";

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

const C = {
  violet: "#290024",
  apricot: "#D4954D",
  olive: "#775533",
  custard: "#E3DEA4",
  success: "#2f9e57",
  ink: "#3a1430",
};
const methodColor: Record<string, string> = { qris: C.apricot, cash: C.olive, transfer: C.violet };
const methodLabel: Record<string, string> = { qris: "QRIS", cash: "Tunai", transfer: "Transfer" };

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
  const methodTotal = Object.values(byMethod).reduce((a, b) => a + b, 0);

  const byProduct: Record<string, { qty: number; rev: number }> = {};
  inRange.forEach((t) =>
    t.items.forEach((it) => {
      byProduct[it.name] = byProduct[it.name] ?? { qty: 0, rev: 0 };
      byProduct[it.name].qty += it.quantity;
      byProduct[it.name].rev += it.total;
    })
  );
  const topProducts = Object.entries(byProduct).sort((a, b) => b[1].rev - a[1].rev);

  const byDay: Record<string, number> = {};
  inRange.forEach((t) => {
    const d = t.createdAt.slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + t.total;
  });
  const days = Object.entries(byDay).sort();

  // ---- ECharts options (solid palette) ----
  const donutOption: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => `${p.name}<br/>${formatRupiah(p.value)}` },
    legend: {
      bottom: 0,
      left: "center",
      icon: "circle",
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: C.ink, fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["56%", "80%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: false,
        itemStyle: { borderColor: "#fff", borderWidth: 3, borderRadius: 6 },
        label: { show: false },
        data: Object.entries(byMethod).map(([m, v]) => ({
          name: methodLabel[m] ?? m,
          value: v,
          itemStyle: { color: methodColor[m] ?? C.olive },
        })),
      },
    ],
  };

  const dailyOption: EChartsOption = {
    grid: { left: 4, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: "axis", formatter: (ps: any) => `${ps[0].axisValue}<br/>${formatRupiah(ps[0].value)}` },
    xAxis: {
      type: "category",
      data: days.map((d) => d[0].slice(5)),
      axisLine: { lineStyle: { color: C.olive } },
      axisTick: { show: false },
      axisLabel: { color: C.olive, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#00000010" } },
      axisLabel: { color: C.olive, fontSize: 10, formatter: (v: number) => (v >= 1000 ? v / 1000 + "k" : String(v)) },
    },
    series: [
      {
        type: "bar",
        data: days.map(([, v]) => v),
        barWidth: "52%",
        itemStyle: { color: C.olive, borderRadius: [6, 6, 0, 0] },
      },
    ],
  };

  const prodH = Math.max(150, topProducts.length * 40);
  const prodOption: EChartsOption = {
    grid: { left: 4, right: 16, top: 8, bottom: 4, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: any) => `${ps[0].name}<br/>${formatRupiah(ps[0].value)}` },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#00000010" } },
      axisLabel: { color: C.olive, fontSize: 10, formatter: (v: number) => (v >= 1000 ? v / 1000 + "k" : String(v)) },
    },
    yAxis: {
      type: "category",
      data: topProducts.map(([n]) => n).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.ink, fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        data: topProducts.map(([, v]) => v.rev).reverse(),
        barWidth: "55%",
        itemStyle: { color: C.apricot, borderRadius: [0, 6, 6, 0] },
      },
    ],
  };

  const kpis: { label: string; value: string; icon: IconName; bg: string }[] = [
    { label: "Total Penjualan", value: formatRupiah(sales), icon: "wallet", bg: "bg-violet" },
    { label: "Transaksi", value: String(count), icon: "receipt", bg: "bg-apricot" },
    { label: "Rata-rata", value: formatRupiah(avg), icon: "spark", bg: "bg-olive" },
    { label: "Pajak", value: formatRupiah(tax), icon: "tag", bg: "bg-success" },
    { label: "Diskon", value: formatRupiah(discount), icon: "minus", bg: "bg-violet" },
  ];

  function exportSales() {
    const rows: (string | number)[][] = [["No", "Waktu", "Kasir", "Pelanggan", "Metode", "Subtotal", "Diskon", "Pajak", "Total"]];
    inRange.forEach((t) =>
      rows.push([t.number, t.createdAt, t.cashier, t.customerName ?? "", t.paymentMethod, t.subtotal, t.discount, t.tax, t.total])
    );
    download("laporan-penjualan.csv", toCSV(rows));
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-apricot/10" />
      <div className="pointer-events-none absolute -left-20 bottom-10 h-64 w-64 rounded-full bg-violet/5" />

      <div className="relative">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Laporan</h1>
            <p className="text-sm text-olive">Analitik penjualan & metode pembayaran</p>
          </div>
          <button onClick={exportSales} className="btn-primary">
            <Icon name="transactions" size={16} /> Export CSV
          </button>
        </div>

        {/* Date range */}
        <div className="seg mb-5 w-full max-w-md">
          <div className="flex items-center gap-2 px-1">
            <Icon name="shifts" size={16} className="text-gray-600" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto border-0 bg-transparent px-1" />
            <span className="text-sm text-gray-600">s.d</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto border-0 bg-transparent px-1" />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <div key={k.label} className="card card-pad">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${k.bg} text-white`}>
                <Icon name={k.icon} size={17} />
              </span>
              <div className="mt-2 text-xs text-gray-600">{k.label}</div>
              <div className="mt-0.5 text-lg font-extrabold text-ink tnum">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Bento charts */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card card-pad lg:col-span-1">
            <h2 className="section-title mb-1">Per Metode Pembayaran</h2>
            {Object.keys(byMethod).length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Tidak ada data.</p>
            ) : (
              <div className="relative">
                <EChart option={donutOption} height={250} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: 28 }}>
                  <span className="text-[10px] font-medium text-olive">Total</span>
                  <span className="text-sm font-extrabold text-ink tnum">{formatRupiah(methodTotal)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad lg:col-span-2">
            <h2 className="section-title mb-1">Tren Penjualan Harian</h2>
            {days.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Tidak ada data.</p>
            ) : (
              <EChart option={dailyOption} height={250} />
            )}
          </div>
        </div>

        {/* Per product */}
        <div className="card card-pad mt-6">
          <h2 className="section-title mb-2">Penjualan per Produk</h2>
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Tidak ada data.</p>
          ) : (
            <>
              <EChart option={prodOption} height={prodH} />
              <div className="mt-4 overflow-x-auto pretty-scroll">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-600">
                    <tr>
                      <th className="py-2 font-semibold">Produk</th>
                      <th className="py-2 text-right font-semibold">Qty</th>
                      <th className="py-2 text-right font-semibold">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map(([name, v]) => (
                      <tr key={name} className="border-t border-black/5">
                        <td className="py-2 font-medium text-ink">{name}</td>
                        <td className="py-2 text-right tnum text-gray-600">{v.qty}</td>
                        <td className="py-2 text-right font-semibold tnum text-olive">{formatRupiah(v.rev)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
