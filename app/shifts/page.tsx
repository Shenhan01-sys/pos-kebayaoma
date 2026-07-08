"use client";

import { useState } from "react";
import { shifts, formatRupiah } from "@/lib/dummy";

export default function ShiftsPage() {
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Shift Kasir</h1>
      <div className="space-y-3">
        {shifts.map((s) => {
          const isClosed = closed[s.id];
          const expected = s.startingCash + s.totalCash;
          return (
            <div key={s.id} className="rounded-xl bg-white p-4 shadow">
              <div className="flex items-center justify-between">
                <div className="font-bold">{s.user}</div>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    isClosed ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-700"
                  }`}
                >
                  {isClosed ? "Tutup" : s.status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  <div className="text-gray-500">Mulai</div>
                  <div>{new Date(s.start).toLocaleString("id-ID")}</div>
                </div>
                <div>
                  <div className="text-gray-500">Modal Awal</div>
                  <div>{formatRupiah(s.startingCash)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Total Transaksi</div>
                  <div>{s.totalTransactions}</div>
                </div>
                <div>
                  <div className="text-gray-500">Total Penjualan</div>
                  <div className="font-bold text-olive">{formatRupiah(s.totalSales)}</div>
                </div>
                <div>
                  <div className="text-gray-500">QRIS</div>
                  <div>{formatRupiah(s.totalQris)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Tunai</div>
                  <div>{formatRupiah(s.totalCash)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Kas Diharapkan</div>
                  <div>{formatRupiah(expected)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Selisih</div>
                  <div className="text-gray-400">—</div>
                </div>
              </div>
              {!isClosed && (
                <button
                  onClick={() => setClosed((c) => ({ ...c, [s.id]: true }))}
                  className="mt-3 w-full rounded-lg bg-olive px-3 py-2 font-bold text-beige"
                >
                  Tutup Shift
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
