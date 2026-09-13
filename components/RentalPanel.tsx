"use client";

// components/RentalPanel.tsx — E7: daftar sewa aktif/jatuh-tempo dengan countdown +
// tombol "Barang diterima" (pengembalian via RPC return_rental; stok masuk saat diterima).

import { useState } from "react";
import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { formatRupiah } from "@/lib/dummy";
import { rentalStatus, daysLeft, outstandingQty } from "@/lib/rental";
import { Icon } from "@/components/icons";

export default function RentalPanel() {
  const rentals = useData((s) => s.rentals);
  const returnRental = useData((s) => s.returnRental);
  const auth = useAuth();
  const s = useSettings();
  const staffName = auth.staff?.name ?? s.cashierName;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const today = new Date();
  const open = rentals.filter((r) => r.returnedQty < r.qty);
  const done = rentals.filter((r) => r.returnedQty >= r.qty);
  const list = showDone ? done : open;

  async function accept(r: { id: string; qty: number; returnedQty: number }) {
    const left = outstandingQty(r);
    setBusy(r.id);
    setErr(null);
    const ok = await returnRental(r.id, left, staffName);
    setBusy(null);
    if (!ok) setErr(useData.getState().error ?? "Gagal mencatat pengembalian.");
  }

  if (rentals.length === 0) return null;

  return (
    <div className="card card-pad mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Icon name="box" size={16} /> Sewa
          {open.length > 0 && <span className="pill-apricot">{open.length} aktif</span>}
        </h2>
        <button onClick={() => setShowDone((v) => !v)} className="btn-ghost px-2.5 py-1 text-xs">
          {showDone ? `Sedang disewa (${open.length})` : `Riwayat selesai (${done.length})`}
        </button>
      </div>
      {err && <p className="mb-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
      {list.length === 0 && <p className="text-sm text-gray-600">Tidak ada data.</p>}
      <div className="space-y-2">
        {list.map((r) => {
          const st = rentalStatus({ due_date: r.dueDate, qty: r.qty, returned_qty: r.returnedQty }, today);
          const dl = daysLeft(r.dueDate, today);
          const pill =
            st === "lewat" ? "bg-danger/10 text-danger" :
            st === "jatuh-tempo" ? "bg-warning/15 text-warning" :
            st === "selesai" ? "bg-success/10 text-success" :
            "bg-violet/10 text-violet";
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-beige/50 px-3 py-2 text-sm">
              <span className={`pill ${pill}`}>{st}</span>
              <b className="text-ink">{r.productName}</b>
              <span className="text-xs text-gray-600">×{r.qty}{r.returnedQty > 0 ? ` (kembali ${r.returnedQty})` : ""}</span>
              <span className="text-xs text-gray-600">{r.customerName ?? "—"}</span>
              {r.customerPhone && <span className="text-xs text-gray-500">{r.customerPhone}</span>}
              <span className="text-xs text-gray-600">nota {r.txNumber}</span>
              <span className="text-xs text-gray-600">
                {st === "lewat" ? `lewat ${-dl} hari` : st === "jatuh-tempo" ? "HARI INI harus kembali" : `kembali ${r.dueDate} (${dl} hari lagi)`}
              </span>
              {st !== "selesai" && (
                <button onClick={() => accept(r)} disabled={busy !== null} className="btn-violet ml-auto px-3 py-1 text-xs disabled:opacity-40">
                  {busy === r.id ? "Menyimpan…" : `Barang diterima (${outstandingQty(r)})`}
                </button>
              )}
              {r.deposit ? <span className="text-xs text-gray-500">depo {formatRupiah(r.deposit)}</span> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">Stok masuk kembali saat "Barang diterima" — bukan otomatis saat tanggal lewat (pengembalian diverifikasi kasir). Reminder H-20% / H-0 / overdue terkirim otomatis bila Fonnte tertata.</p>
    </div>
  );
}
