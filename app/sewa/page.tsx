"use client";

// E17: halaman Sewa — daftar sewa (aktif / hari ini / terlambat / selesai), sewa baru,
// "Barang diterima" (boleh sebagian), dan pengingat WhatsApp manual. Menggantikan tombol Sewa di POS
// dan RentalPanel di /transactions (keputusan user 2026-10-02).
// Aturan bisnis tetap (E7): tarif flat per unit, stok baru kembali saat DITERIMA (bukan otomatis),
// status dihitung dari jatuh tempo vs jumlah kembali; deposit tercatat di buku (belum modul kas).

import { useEffect, useMemo, useState } from "react";
import { useData, type RentalRow } from "@/store/data";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { formatRupiah } from "@/lib/dummy";
import {
  daysLeft,
  depositTotal,
  filterRentals,
  formatDateId,
  matchesTab,
  outstandingQty,
  reminderText,
  rentalSummary,
  rentTotal,
  statusOf,
  waLink,
  type RentalTab,
} from "@/lib/rental";
import RentalNewModal from "@/components/RentalNewModal";
import { Icon } from "@/components/icons";

const TABS: { id: RentalTab; label: string }[] = [
  { id: "aktif", label: "Aktif" },
  { id: "hari-ini", label: "Hari ini" },
  { id: "terlambat", label: "Terlambat" },
  { id: "selesai", label: "Selesai" },
];

const PILL: Record<string, string> = {
  aktif: "pill bg-violet/10 text-violet",
  sebagian: "pill bg-violet/10 text-violet",
  "jatuh-tempo": "pill-warning",
  lewat: "pill-danger",
  selesai: "pill-success",
};
const STATUS_LABEL: Record<string, string> = {
  aktif: "Disewa",
  sebagian: "Sebagian kembali",
  "jatuh-tempo": "Jatuh tempo hari ini",
  lewat: "Terlambat",
  selesai: "Selesai",
};

export default function SewaPage() {
  const rentals = useData((s) => s.rentals);
  const activeStoreId = useData((s) => s.activeStoreId);
  const returnRental = useData((s) => s.returnRental);
  const auth = useAuth();
  const cashierName = useSettings((s) => s.cashierName);
  const staffName = auth.staff?.name ?? cashierName ?? "";

  const [tab, setTab] = useState<RentalTab>("aktif");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [returning, setReturning] = useState<RentalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  async function refresh() {
    await Promise.all([useData.getState().fetchRentals(), useData.getState().fetchProducts()]);
    setNow(new Date());
  }

  useEffect(() => {
    let alive = true;
    refresh().finally(() => alive && setLoading(false));
    // Realtime tabel rentals belum aktif di DB → segarkan tiap 60 dtk saat tab terlihat
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [activeStoreId]);

  const summary = useMemo(() => rentalSummary(rentals, now), [rentals, now]);
  const list = useMemo(() => filterRentals(rentals, { tab, query }, now), [rentals, tab, query, now]);
  const count = (t: RentalTab) => rentals.filter((r) => matchesTab(r, t, now)).length;

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 4000);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Sewa</h1>
          <p className="text-sm text-gray-600">Barang disewakan, jatuh tempo, dan pengembalian.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refresh()} className="btn-ghost px-3 py-2 text-sm" aria-label="Muat ulang">Muat ulang</button>
          <button onClick={() => setNewOpen(true)} className="btn-primary px-4 py-2.5 text-sm">
            <Icon name="plus" size={16} /> Sewa baru
          </button>
        </div>
      </div>

      {!activeStoreId && (
        <p className="mb-3 rounded-2xl bg-warning/10 px-3 py-2 text-sm text-warning">
          Pilih toko operasional (MJL/KTB) di pojok kiri dulu untuk membuat sewa baru.
        </p>
      )}
      {flash && <p role="status" className="mb-3 rounded-2xl bg-success/10 px-3 py-2 text-sm font-medium text-success">{flash}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sedang disewa" value={String(summary.open)} sub={`${summary.unitsOut} unit di luar`} />
        <Stat label="Jatuh tempo hari ini" value={String(summary.dueToday)} tone={summary.dueToday ? "warning" : undefined} />
        <Stat label="Terlambat" value={String(summary.overdue)} tone={summary.overdue ? "danger" : undefined} />
        <Stat label="Deposit ditahan" value={formatRupiah(summary.depositHeld)} sub="di buku, bukan kas" small />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="seg overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`seg-item whitespace-nowrap ${tab === t.id ? "seg-item-active" : ""}`}>
              {t.label} <span className="ml-1 text-xs text-gray-500">{count(t.id)}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9"
            placeholder="Cari penyewa, HP, nota, barang…"
            aria-label="Cari sewa"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="search" size={16} /></span>
        </div>
      </div>

      {loading && rentals.length === 0 ? (
        <p className="card card-pad text-sm text-gray-600">Memuat data sewa…</p>
      ) : list.length === 0 ? (
        <div className="card card-pad text-center">
          <p className="mb-1 font-semibold text-ink">
            {rentals.length === 0 ? "Belum ada sewa." : query ? "Tidak ada sewa yang cocok." : "Tidak ada data di tab ini."}
          </p>
          {rentals.length === 0 && (
            <button onClick={() => setNewOpen(true)} className="btn-primary mt-2 px-4 py-2 text-sm">Buat sewa pertama</button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((r) => (
            <RentalCard key={r.id} r={r} now={now} onReturn={() => setReturning(r)} />
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-gray-500">
        Stok masuk kembali saat &quot;Terima barang&quot; ditekan — bukan otomatis saat tanggal lewat. Deposit hanya dicatat sebagai
        info (belum modul kas); kembalikan ke penyewa secara manual.
      </p>

      {newOpen && <RentalNewModal cashierName={staffName} onClose={() => setNewOpen(false)} />}
      {returning && (
        <ReturnDialog
          r={returning}
          staffName={staffName}
          onClose={() => setReturning(null)}
          onDone={(msg) => {
            setReturning(null);
            showFlash(msg);
          }}
          returnRental={returnRental}
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone, small }: { label: string; value: string; sub?: string; tone?: "warning" | "danger"; small?: boolean }) {
  const color = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="card card-pad">
      <div className="text-xs text-gray-600">{label}</div>
      <div className={`tnum font-bold ${small ? "text-lg" : "text-2xl"} ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

function RentalCard({ r, now, onReturn }: { r: RentalRow; now: Date; onReturn: () => void }) {
  const rawStatus = statusOf(r, now);
  const dl = daysLeft(r.dueDate, now);
  const out = outstandingQty(r);
  // "sebagian" tidak boleh menutupi keterlambatan: urgensi dari sisa hari + sisa unit
  const st = out > 0 ? (dl < 0 ? "lewat" : dl === 0 ? "jatuh-tempo" : rawStatus) : "selesai";
  const wa = waLink(r.customerPhone, reminderText(r, now));
  const countdown =
    st === "selesai" ? `Selesai · jatuh tempo ${formatDateId(r.dueDate)}`
    : dl < 0 ? `Terlambat ${-dl} hari (harus kembali ${formatDateId(r.dueDate)})`
    : dl === 0 ? "Harus kembali HARI INI"
    : `Kembali ${formatDateId(r.dueDate)} · ${dl} hari lagi`;
  const urgent = st === "lewat" ? "ring-danger/30" : st === "jatuh-tempo" ? "ring-warning/40" : "";
  return (
    <div className={`card card-pad ring-1 ${urgent}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={PILL[st]}>{STATUS_LABEL[st]}{r.returnedQty > 0 && out > 0 ? " · sebagian kembali" : ""}</span>
            <b className="text-ink">{r.productName}</b>
            <span className="text-sm text-gray-600">×{r.qty}{r.returnedQty > 0 ? ` · kembali ${r.returnedQty}/${r.qty}` : ""}</span>
          </div>
          <div className="mt-1 text-sm text-gray-700">
            {r.customerName ?? "—"}
            {r.customerPhone ? <span className="text-gray-500"> · {r.customerPhone}</span> : null}
          </div>
          <div className={`mt-0.5 text-sm font-medium ${st === "lewat" ? "text-danger" : st === "jatuh-tempo" ? "text-warning" : "text-gray-600"}`}>{countdown}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            Nota {r.txNumber} · mulai {formatDateId(r.startDate)} · sewa {formatRupiah(rentTotal(r.rentPrice, r.qty))}
            {depositTotal(r) > 0 ? ` · deposit ${formatRupiah(depositTotal(r))}` : ""}
          </div>
        </div>
        {st !== "selesai" && (
          <div className="flex shrink-0 items-center gap-2">
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-success px-3 py-2 text-xs" title="Kirim pengingat via WhatsApp">
                WhatsApp
              </a>
            ) : (
              <span className="px-2 text-[11px] text-gray-400" title="Tidak ada nomor HP valid">tanpa HP</span>
            )}
            <button onClick={onReturn} className="btn-violet px-3 py-2 text-xs">Terima barang ({out})</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnDialog({
  r,
  staffName,
  onClose,
  onDone,
  returnRental,
}: {
  r: RentalRow;
  staffName: string;
  onClose: () => void;
  onDone: (msg: string) => void;
  returnRental: (id: string, qty: number, staff: string) => Promise<boolean>;
}) {
  const out = outstandingQty(r);
  const [qty, setQty] = useState(out);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const full = qty >= out;

  async function confirm() {
    if (busy) return; // cegah klik ganda → stok masuk dobel
    setBusy(true);
    setErr(null);
    useData.setState({ error: null });
    const ok = await returnRental(r.id, qty, staffName);
    setBusy(false);
    if (!ok) {
      setErr(useData.getState().error ?? "Gagal mencatat pengembalian.");
      return;
    }
    onDone(
      full
        ? `${r.productName} diterima kembali — sewa selesai.${depositTotal(r) > 0 ? ` Deposit sewa ini ${formatRupiah(depositTotal(r))} — kembalikan ke ${r.customerName ?? "penyewa"} bila belum.` : ""}`
        : `${qty} unit ${r.productName} diterima — sisa ${out - qty} unit masih di penyewa.`
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-[400px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">Terima barang</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600" aria-label="Tutup">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="mb-1 font-semibold text-ink">{r.productName}</p>
        <p className="mb-3 text-sm text-gray-600">
          {r.customerName ?? "—"} · nota {r.txNumber} · belum kembali <b>{out}</b> dari {r.qty} unit
        </p>
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-beige/60 px-3 py-2">
          <span className="text-sm text-olive">Jumlah diterima</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-soft ring-1 ring-black/5 active:scale-90" aria-label="Kurangi"><Icon name="minus" size={14} /></button>
            <span className="tnum w-8 text-center text-lg font-bold">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(out, q + 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-soft ring-1 ring-black/5 active:scale-90" aria-label="Tambah"><Icon name="plus" size={14} /></button>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-600">
          {full ? "Semua unit kembali — sewa ditandai selesai." : `Sisa ${out - qty} unit tetap tercatat disewa.`} Stok produk bertambah {qty}.
        </p>
        {full && depositTotal(r) > 0 && (
          <p className="mb-3 rounded-2xl bg-warning/10 px-3 py-2 text-xs text-warning">
            Deposit sewa ini {formatRupiah(depositTotal(r))} ({formatRupiah(r.deposit ?? 0)} × {r.qty} unit) — kembalikan ke penyewa bila belum.
            Pengembalian deposit belum dicatat oleh sistem.
          </p>
        )}
        {err && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 py-2.5">Batal</button>
          <button onClick={confirm} disabled={busy} className="btn-violet flex-1 py-2.5 disabled:opacity-50">
            {busy ? "Menyimpan…" : `Terima ${qty} unit`}
          </button>
        </div>
      </div>
    </div>
  );
}
