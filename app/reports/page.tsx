"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { transactions as dummyTx, formatRupiah } from "@/lib/dummy";
import { getAllTransactions } from "@/store/cart";
import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import { canSeeProfit } from "@/lib/roles";
import { humanizeError } from "@/lib/errors";
import { Icon, type IconName } from "@/components/icons";
import { computeReport } from "@/lib/report-data";
import { exportPdf, exportXlsx, type ExportMeta } from "@/lib/report-export";
import dynamic from "next/dynamic";
import type { EChartsCoreOption } from "echarts/core";

const EChart = dynamic(() => import("@/components/EChart"), { ssr: false });

const C = {
  violet: "#290024",
  apricot: "#D4954D",
  olive: "#775533",
  custard: "#E3DEA4",
  success: "#2f9e57",
  ink: "#3a1430",
};
const methodColor: Record<string, string> = { qris: C.apricot, cash: C.olive, transfer: C.violet, shopee: C.success };
const methodLabel: Record<string, string> = { qris: "QRIS", cash: "Tunai", transfer: "Transfer", shopee: "Shopee" };

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const stores = useData((s) => s.stores);
  const activeStoreId = useData((s) => s.activeStoreId);
  const storeName = useData((s) => s.stores.find((t) => t.id === s.activeStoreId)?.name);
  // E3: filter outlet — default ikut switcher (manager boleh "semua").
  const [storeSel, setStoreSel] = useState<string>("semua");
  useEffect(() => { setStoreSel(activeStoreId ?? "semua"); }, [activeStoreId]);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const methodRef = useRef<HTMLDivElement>(null);
  const dailyRef = useRef<HTMLDivElement>(null);
  const prodRef = useRef<HTMLDivElement>(null);
  const auth = useAuth();

  // E12: laba/HPP hanya superadmin (FE-only v1; DB-level = plan U2).
  const canSeeProfitData = canSeeProfit(auth.staff?.role);

  const all = getAllTransactions(dummyTx).filter((t) => t.status === "paid");
  const inRangeTxs = useMemo(
    () => getAllTransactions(dummyTx).filter((t) => {
      const d = new Date(t.createdAt);
      if (from && d < new Date(from + "T00:00:00")) return false;
      if (to && d > new Date(to + "T23:59:59")) return false;
      return true;
    }),
    [from, to]
  );
  const report = useMemo(
    () => computeReport(inRangeTxs, storeSel === "semua" ? null : storeSel, from, to),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeSel, from, to, all.length]
  );
  const { sales, count, avg, discount, tax, hpp, bersih, unknownQty } = report;
  const inRange = { length: count };

  const byMethod = report.byMethod;
  const methodTotal = Object.values(byMethod).reduce((a, b) => a + b, 0);
  const topProducts = report.topProducts;
  const days = report.byDay;

  // ---- ECharts options (solid palette) ----
  const donutOption: EChartsCoreOption = {
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

  const dailyOption: EChartsCoreOption = {
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
  const prodOption: EChartsCoreOption = {
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

  // E12: laba/HPP hanya superadmin (FE-only v1; DB-level = plan U2).
  const kpis: { label: string; value: string; icon: IconName; bg: string }[] = [
    { label: "Omzet", value: formatRupiah(sales), icon: "wallet", bg: "bg-violet" },
    ...(canSeeProfitData
      ? [
          { label: "HPP", value: formatRupiah(hpp), icon: "box", bg: "bg-olive" },
          { label: "Bersih", value: formatRupiah(bersih), icon: "spark", bg: "bg-success" },
        ]
      : []),
    { label: "Transaksi", value: String(count), icon: "receipt", bg: "bg-apricot" },
    { label: "Rata-rata", value: formatRupiah(avg), icon: "shifts", bg: "bg-violet" },
  ];

  function meta(): ExportMeta {
    return {
      storeLabel: storeSel === "semua" ? "SEMUA" : stores.find((t) => t.id === storeSel)?.prefix ?? "MJL",
      from, to, storeName: "Kebaya Oma",
    };
  }
  async function doExportPdf() {
    setExporting("pdf"); setExportError(null);
    try {
      await exportPdf({
        report, meta: meta(),
        chartNodes: { method: methodRef.current ?? undefined, daily: dailyRef.current ?? undefined, products: prodRef.current ?? undefined },
        includeProfit: canSeeProfitData,
      });
    } catch (e: any) {
      setExportError(humanizeError(e, { action: "membuat PDF" }));
    } finally {
      setExporting(null);
    }
  }
  async function doExportXlsx() {
    setExporting("xlsx"); setExportError(null);
    try { await exportXlsx(report, meta(), canSeeProfitData); }
    catch (e: any) { setExportError(humanizeError(e, { action: "membuat Excel" })); }
    finally { setExporting(null); }
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
            <p className="text-sm text-olive">Analitik penjualan &amp; metode pembayaran</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={storeSel} onChange={(e) => setStoreSel(e.target.value)} className="input w-auto" aria-label="Filter outlet">
              <option value="semua">Semua Outlet</option>
              {stores.map((t) => <option key={t.id} value={t.id}>{t.prefix} - {t.name}</option>)}
            </select>
            <button onClick={doExportPdf} disabled={exporting !== null || count === 0} className="btn-primary disabled:opacity-50">
              <Icon name="receipt" size={16} /> {exporting === "pdf" ? "Membuat PDF…" : "Export PDF"}
            </button>
            <button onClick={doExportXlsx} disabled={exporting !== null || count === 0} className="btn-violet disabled:opacity-50">
              <Icon name="transactions" size={16} /> {exporting === "xlsx" ? "Membuat…" : "Export Excel"}
            </button>
          </div>
        </div>
        {exportError && (
          <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{exportError}</p>
        )}

        {/* Date range */}
        <div className="seg mb-5 w-full max-w-md">
          <div className="flex items-center gap-2 px-1">
            <Icon name="shifts" size={16} className="text-gray-600" />
            <label className="flex items-center gap-1 text-sm text-gray-600">
              Dari
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto border-0 bg-transparent px-1" aria-label="Tanggal mulai" />
            </label>
            <span className="text-sm text-gray-600">s.d</span>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              Sampai
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto border-0 bg-transparent px-1" aria-label="Tanggal akhir" />
            </label>
          </div>
        </div>

        {inRange.length === 0 ? (
          <div className="card card-pad py-12 text-center">
            <p className="text-gray-600">Tidak ada transaksi pada rentang tanggal ini.</p>
          </div>
        ) : (
        <>
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

        {/* P&L ringkas — superadmin saja (E12); sama persis dgn PDF/xlsx (sumber: computeReport) */}
        {canSeeProfitData && (
          <div className="card card-pad mt-4 text-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span><span className="text-gray-600">Omzet</span> <b className="tnum text-ink">{formatRupiah(sales)}</b></span>
              <span>− <span className="text-gray-600">HPP</span> <b className="tnum text-ink">{formatRupiah(hpp)}</b></span>
              <span>− <span className="text-gray-600">Pengeluaran</span> <b className="tnum text-ink">{formatRupiah(report.expenses)}</b> <span className="text-xs text-gray-500">(belum termasuk)</span></span>
              <span>= <span className="text-gray-600">Keuntungan Bersih</span> <b className="tnum text-success">{formatRupiah(bersih)}</b></span>
            </div>
            {unknownQty > 0 && (
              <p className="mt-1 text-xs text-warning">{unknownQty} unit tanpa data modal — HPP belum mencakupnya.</p>
            )}
          </div>
        )}

        {/* Bento charts */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div ref={methodRef} className="card card-pad lg:col-span-1">
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

          <div ref={dailyRef} className="card card-pad lg:col-span-2">
            <h2 className="section-title mb-1">Tren Penjualan Harian</h2>
            {days.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Tidak ada data.</p>
            ) : (
              <EChart option={dailyOption} height={250} />
            )}
          </div>
        </div>

        {/* Per product */}
        <div ref={prodRef} className="card card-pad mt-6">
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
        </>
        )}
      </div>
    </div>
  );
}
