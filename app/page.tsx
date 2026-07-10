"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { transactions as dummyTx, formatRupiah, type Transaction } from "@/lib/dummy";
import { getAllTransactions, subscribeTransactions } from "@/store/cart";
import { useSettings } from "@/store/settings";
import { useData } from "@/store/data";
import { Icon, type IconName } from "@/components/icons";
import EChart from "@/components/EChart";
import type { EChartsOption } from "echarts";

const C = {
  violet: "#290024",
  apricot: "#D4954D",
  olive: "#775533",
  custard: "#E3DEA4",
  success: "#2f9e57",
  ink: "#3a1430",
};

const kpiStyles: Record<string, { chip: string; tint: string; icon: IconName }> = {
  sales: { chip: "bg-violet", tint: "bg-violet/5", icon: "wallet" },
  count: { chip: "bg-apricot", tint: "bg-apricot/10", icon: "receipt" },
  low: { chip: "bg-olive", tint: "bg-olive/10", icon: "alert" },
  open: { chip: "bg-success", tint: "bg-success/10", icon: "pos" },
};

const methodColor: Record<string, string> = {
  qris: "#D4954D",
  cash: "#775533",
  transfer: "#4a0e3f",
};

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
  const methodTotal = Object.values(byMethod).reduce((a, b) => a + b, 0);

  const top: Record<string, number> = {};
  paid.forEach((t) =>
    t.items.forEach((it) => {
      top[it.name] = (top[it.name] ?? 0) + it.quantity;
    })
  );
  const topProducts = Object.entries(top)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const lowStock = products
    .flatMap((p) => p.variants)
    .filter((v) => v.stock <= 5)
    .map((v) => ({ ...v, product: products.find((p) => p.variants.includes(v)) }));

  const methodColor: Record<string, string> = { qris: C.apricot, cash: C.olive, transfer: C.violet };
  const methodLabel: Record<string, string> = { qris: "QRIS", cash: "Tunai", transfer: "Transfer" };

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

  const prodH = Math.max(150, topProducts.length * 40);
  const prodOption: EChartsOption = {
    grid: { left: 4, right: 16, top: 8, bottom: 4, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: any) => `${ps[0].name}<br/>${ps[0].value} pcs` },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#00000010" } },
      axisLabel: { color: C.olive, fontSize: 10 },
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
        data: topProducts.map(([, q]) => q).reverse(),
        barWidth: "55%",
        itemStyle: { color: C.olive, borderRadius: [0, 6, 6, 0] },
      },
    ],
  };

  const cards = [
    { key: "sales", label: "Penjualan Hari Ini", value: formatRupiah(sales), href: "/transactions", sub: "Total nilai transaksi lunas" },
    { key: "count", label: "Transaksi", value: String(count), href: "/transactions", sub: "Pesanan berstatus lunas" },
    { key: "low", label: "Stok Menipis", value: String(lowStock.length), href: "/products", sub: "Varian ≤ 5 unit" },
    { key: "open", label: "Buka Kasir", value: "Mulai", href: "/pos", sub: "Lanjut ke layar POS" },
  ];

  return (
    <div className="relative">
      {/* Decorative solid blobs for depth */}
      <div className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-apricot/10" />
      <div className="pointer-events-none absolute -left-20 top-40 h-72 w-72 rounded-full bg-violet/5" />
      <div className="pointer-events-none absolute right-10 bottom-0 h-40 w-40 rounded-full bg-olive/5" />

      <div className="relative">
        {/* Hero greeting */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-violet text-3xl shadow-soft-lg">
              🪡
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                Halo, {s.cashierName} 👋
              </h1>
              <p className="text-sm text-olive/80">{s.storeName} · {s.address}</p>
            </div>
          </div>
          <Link href="/pos" className="btn-primary">
            <Icon name="pos" size={18} /> Mulai Transaksi
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => {
            const st = kpiStyles[c.key];
            return (
              <Link
                key={c.key}
                href={c.href}
                className="group relative overflow-hidden rounded-3xl card card-pad transition hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full ${st.tint}`} />
                <div className="relative flex items-center justify-between">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${st.chip} text-white`}>
                    <Icon name={st.icon} size={18} />
                  </span>
                  <Icon name="spark" size={16} className="text-gray-300" />
                </div>
                <div className="relative mt-3 text-xs font-medium text-gray-600">{c.label}</div>
                <div className="relative mt-0.5 text-2xl font-extrabold text-ink tnum">{c.value}</div>
                <div className="relative mt-1 text-[11px] text-gray-500">{c.sub}</div>
              </Link>
            );
          })}
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {/* Donut: payment method */}
          <div className="card card-pad lg:col-span-1">
            <h2 className="section-title mb-1">Pembayaran per Metode</h2>
            {Object.keys(byMethod).length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-600">Belum ada penjualan.</p>
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

          {/* Top products */}
          <div className="card card-pad lg:col-span-1">
            <h2 className="section-title mb-2">Produk Terlaris</h2>
            {topProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-600">Belum ada penjualan.</p>
            ) : (
              <EChart option={prodOption} height={prodH} />
            )}
          </div>

          {/* Low stock */}
          <div className="card card-pad lg:col-span-1">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-title">Stok Menipis</h2>
              <span className="pill-warning">{lowStock.length}</span>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm text-gray-600">Stok aman. 🎉</p>
            ) : (
              <ul className="space-y-1.5">
                {lowStock.slice(0, 6).map((v) => (
                  <li key={v.id} className="flex items-center justify-between rounded-2xl bg-beige/60 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      {v.product?.name} <span className="text-gray-600">· {v.size}/{v.color}</span>
                    </span>
                    <span className={v.stock === 0 ? "pill-danger" : "pill-warning"}>{v.stock}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="card card-pad mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title">Transaksi Terakhir</h2>
            <Link href="/transactions" className="text-xs font-semibold text-apricot">Lihat semua →</Link>
          </div>
          <div className="overflow-x-auto pretty-scroll">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 font-medium">No</th>
                  <th className="py-2 font-medium">Kasir</th>
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {all.slice(0, 6).map((t) => (
                  <tr key={t.id} className="border-t border-black/5">
                    <td className="py-2.5 font-mono text-xs text-gray-600">{t.number}</td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="avatar h-6 w-6 bg-apricot text-[10px]">{t.cashier.slice(0, 1).toUpperCase()}</span>
                        {t.cashier}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold tnum text-ink">{formatRupiah(t.total)}</td>
                    <td className="py-2.5">
                      <span className={t.status === "paid" ? "pill-success" : t.status === "cancelled" || t.status === "refunded" ? "pill-danger" : "pill-warning"}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {all.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-600">Belum ada transaksi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
