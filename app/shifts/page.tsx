"use client";

import { useState } from "react";
import { shifts, formatRupiah } from "@/lib/dummy";
import { Icon } from "@/components/icons";

export default function ShiftsPage() {
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-ink">Shift Kasir</h1>
      <div className="space-y-3">
        {shifts.map((s) => {
          const isClosed = closed[s.id];
          const expected = s.startingCash + s.totalCash;
          return (
            <div key={s.id} className="card card-pad">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="avatar h-10 w-10 bg-grad-violet">{s.user.slice(0, 1).toUpperCase()}</span>
                  <div className="font-bold text-ink">{s.user}</div>
                </div>
                <span className={`pill ${isClosed ? "pill-muted" : "pill-success"}`}>
                  {isClosed ? "Tutup" : s.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Mulai" value={new Date(s.start).toLocaleString("id-ID")} />
                <Stat label="Modal Awal" value={formatRupiah(s.startingCash)} />
                <Stat label="Total Transaksi" value={String(s.totalTransactions)} />
                <Stat label="Total Penjualan" value={formatRupiah(s.totalSales)} accent />
                <Stat label="QRIS" value={formatRupiah(s.totalQris)} />
                <Stat label="Tunai" value={formatRupiah(s.totalCash)} />
                <Stat label="Kas Diharapkan" value={formatRupiah(expected)} />
                <Stat label="Selisih" value="—" />
              </div>
              {!isClosed && (
                <button onClick={() => setClosed((c) => ({ ...c, [s.id]: true }))} className="btn-violet mt-4 w-full py-3">
                  <Icon name="shifts" size={16} /> Tutup Shift
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-beige/60 p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className={`mt-0.5 font-semibold tnum ${accent ? "text-olive" : "text-ink"}`}>{value}</div>
    </div>
  );
}
