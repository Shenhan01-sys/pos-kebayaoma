"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/dummy";
import { useData } from "@/store/data";
import { useSettings } from "@/store/settings";
import { useAuth } from "@/store/auth";
import { Icon } from "@/components/icons";

export default function ShiftsPage() {
  const s = useSettings();
  const auth = useAuth();
  const staffName = auth.staff?.name ?? s.cashierName;
  const { shifts, transactions, openShift, closeShift, currentShift, loading } = useData();
  const [openModal, setOpenModal] = useState(false);
  const [startingCash, setStartingCash] = useState("500000");
  const [endingCash, setEndingCash] = useState("");
  const [closing, setClosing] = useState(false);

  const active = currentShift();

  const activeStats = (() => {
    if (!active) return null;
    const since = new Date(active.opened_at);
    const txs = transactions.filter((t) => t.status === "paid" && new Date(t.createdAt) >= since);
    const totalTransactions = txs.length;
    const totalSales = txs.reduce((sum, t) => sum + t.total, 0);
    const totalQris = txs.filter((t) => t.paymentMethod === "qris").reduce((sum, t) => sum + t.total, 0);
    const totalCash = txs.filter((t) => t.paymentMethod === "cash").reduce((sum, t) => sum + t.total, 0);
    const expected = active.startingCash + totalCash;
    return { totalTransactions, totalSales, totalQris, totalCash, expected };
  })();

  async function handleOpen() {
    await openShift(Number(startingCash) || 0, staffName);
    setOpenModal(false);
    setStartingCash("500000");
  }

  async function handleClose() {
    if (!active) return;
    setClosing(true);
    await closeShift(active.id, Number(endingCash) || 0);
    setClosing(false);
    setEndingCash("");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Shift Kasir</h1>
        {!active && (
          <button onClick={() => setOpenModal(true)} className="btn-primary">
            <Icon name="shifts" size={16} /> Buka Shift
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-600">Memuat shift…</p>}

      {/* Active shift card */}
      {active && activeStats && (
        <div className="card card-pad mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="avatar h-10 w-10 bg-violet">{active.staff_name.slice(0, 1).toUpperCase()}</span>
              <div>
                <div className="font-bold text-ink">{active.staff_name}</div>
                <div className="text-xs text-gray-600">Mulai {new Date(active.opened_at).toLocaleString("id-ID")}</div>
              </div>
            </div>
            <span className="pill-success">Aktif</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Modal Awal" value={formatRupiah(active.startingCash)} />
            <Stat label="Total Transaksi" value={String(activeStats.totalTransactions)} />
            <Stat label="Total Penjualan" value={formatRupiah(activeStats.totalSales)} accent />
            <Stat label="QRIS" value={formatRupiah(activeStats.totalQris)} />
            <Stat label="Tunai" value={formatRupiah(activeStats.totalCash)} />
            <Stat label="Kas Diharapkan" value={formatRupiah(activeStats.expected)} />
            <div className="col-span-2">
              <div className="rounded-2xl bg-beige/60 p-3">
                <label className="block text-xs text-gray-600">Uang Fisik di Laci</label>
                <input
                  type="number"
                  value={endingCash}
                  onChange={(e) => setEndingCash(e.target.value)}
                  className="input mt-1 w-full text-right tnum"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {endingCash && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-beige/60 p-3 text-sm">
              <span className="text-gray-600">Selisih</span>
              <span className={`font-bold tnum ${activeStats.expected - Number(endingCash) === 0 ? "text-success" : "text-danger"}`}>
                {formatRupiah(Number(endingCash) - activeStats.expected)}
              </span>
            </div>
          )}

          <button onClick={handleClose} disabled={closing} className="btn-violet mt-4 w-full py-3">
            <Icon name="shifts" size={16} /> {closing ? "Menutup…" : "Tutup Shift"}
          </button>
        </div>
      )}

      {/* History */}
      {shifts.filter((s) => s.status !== "open").length > 0 && (
        <div className="card card-pad">
          <h2 className="section-title mb-3">Riwayat Shift</h2>
          <div className="space-y-3">
            {shifts
              .filter((s) => s.status !== "open")
              .map((sh) => (
                <div key={sh.id} className="rounded-2xl bg-beige/60 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{sh.staff_name}</span>
                    <span className="pill-muted">{sh.status === "closed" ? "Tutup" : sh.status}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatSm label="Mulai" value={new Date(sh.opened_at).toLocaleString("id-ID")} />
                    <StatSm label="Modal" value={formatRupiah(sh.startingCash)} />
                    <StatSm label="Penjualan" value={formatRupiah(sh.totalSales)} />
                    <StatSm label="Tutup" value={sh.closed_at ? new Date(sh.closed_at).toLocaleString("id-ID") : "—"} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Open shift modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-soft-xl">
            <h2 className="text-lg font-extrabold text-ink">Buka Shift</h2>
            <p className="text-sm text-gray-600">Masukkan modal awal kasir untuk shift ini.</p>
            <input
              type="number"
              value={startingCash}
              onChange={(e) => setStartingCash(e.target.value)}
              className="input mt-4 w-full text-right text-lg font-semibold tnum"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setOpenModal(false)} className="btn-ghost flex-1">
                Batal
              </button>
              <button onClick={handleOpen} className="btn-primary flex-1">
                Buka Shift
              </button>
            </div>
          </div>
        </div>
      )}
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

function StatSm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="font-medium tnum">{value}</div>
    </div>
  );
}
