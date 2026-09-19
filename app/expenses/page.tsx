"use client";

// E8: Petty Cash — pengeluaran kas kecil per toko. Admin + superadmin (matriks E12),
// direct tanpa approval (keputusan user 2026-09-19). Foto bukti opsional.

import { useEffect, useMemo, useState } from "react";
import { formatRupiah } from "@/lib/dummy";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { useSettings } from "@/store/settings";
import {
  EXPENSE_CATEGORIES,
  categorizeExpense,
  expensesByCategory,
  type Expense,
} from "@/lib/expenses";
import { Icon } from "@/components/icons";

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStart = () => todayStr().slice(0, 7) + "-01";

export default function ExpensesPage() {
  const auth = useAuth();
  const stores = useData((s) => s.stores);
  const activeStoreId = useData((s) => s.activeStoreId);
  const expenses = useData((s) => s.expenses);
  const cashierName = useSettings((s) => s.cashierName);
  const pic = auth.staff?.name ?? cashierName ?? "";

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayStr());
  const [storeSel, setStoreSel] = useState<string>("semua");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string>("Lainnya");
  const [date, setDate] = useState(todayStr());
  const [storeForm, setStoreForm] = useState<string>("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    useData.getState().fetchExpenses();
  }, []);
  useEffect(() => { setStoreForm(activeStoreId ?? ""); }, [activeStoreId]);

  const inScope = useMemo(
    () =>
      expenses.filter((e) => {
        if (storeSel !== "semua" && e.storeId !== storeSel) return false;
        const d = new Date(e.date + "T00:00:00");
        if (from && d < new Date(from + "T00:00:00")) return false;
        if (to && d > new Date(to + "T23:59:59")) return false;
        return true;
      }),
    [expenses, storeSel, from, to]
  );
  const total = inScope.reduce((s, e) => s + e.amount, 0);
  const byCat = expensesByCategory(inScope);
  const storeName = (id: string | null) => stores.find((t) => t.id === id)?.name ?? "Umum";

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // Kompres max 1024px JPEG 0.7 (pola foto bukti CheckoutModal)
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });
      const w = Math.min(img.width, 1024);
      const h = Math.round((img.height * w) / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      setPhoto(canvas.toDataURL("image/jpeg", 0.7));
    } catch {
      setErr("Gagal memproses foto.");
    }
  }

  async function submit() {
    setErr(null);
    setMsg(null);
    const amt = parseInt(amount, 10);
    if (!desc.trim()) return setErr("Keterangan wajib diisi.");
    if (!amt || amt <= 0) return setErr("Jumlah harus lebih dari 0.");
    setBusy(true);
    const saved = await useData.getState().addExpense({
      storeId: storeForm || null,
      date,
      description: cat === "Lainnya" ? desc.trim() : `[${cat}] ${desc.trim()}`,
      amount: amt,
      pic: pic || "-",
      photoUrl: photo ?? undefined,
    });
    setBusy(false);
    if (!saved) return setErr(useData.getState().error ?? "Gagal menyimpan pengeluaran.");
    setMsg(`Tersimpan: ${saved.description} · ${formatRupiah(saved.amount)}`);
    setDesc("");
    setAmount("");
    setPhoto(null);
    setCat("Lainnya");
  }

  async function del(e: Expense) {
    if (!confirm(`Hapus pengeluaran "${e.description}" (${formatRupiah(e.amount)})?`)) return;
    const ok = await useData.getState().deleteExpense(e.id);
    if (!ok) setErr(useData.getState().error ?? "Gagal menghapus.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-extrabold text-ink">Petty Cash</h1>
      <p className="mb-4 text-sm text-gray-600">
        Pengeluaran kas kecil operasional toko — masuk baris &ldquo;Pengeluaran&rdquo; di Laporan.
      </p>

      {/* Form catat */}
      <div className="card card-pad mb-4">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-olive">Tanggal</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-olive">Toko</span>
            <select value={storeForm} onChange={(e) => setStoreForm(e.target.value)} className="input">
              <option value="">Umum / gabungan</option>
              {stores.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-olive">Kategori</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-olive">Jumlah (Rp)</span>
            <input
              type="number" min={0} value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="cth: 25000" className="input tnum"
            />
          </label>
        </div>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-olive">Keterangan</span>
          <input
            value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="cth: beli plastik 1 pack / token listrik" className="input"
          />
        </label>
        <div className="mb-3 flex items-center gap-3 text-sm">
          <span className="text-olive">PIC:</span> <b className="text-ink">{pic || "-"}</b>
          <span className="ml-auto flex items-center gap-2">
            <label className="btn-ghost cursor-pointer text-xs">
              <Icon name="camera" size={14} /> {photo ? "Foto siap ✓" : "Foto nota (opsional)"}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            {photo && (
              <button onClick={() => setPhoto(null)} className="text-xs text-danger" aria-label="Hapus foto">
                <Icon name="close" size={14} />
              </button>
            )}
          </span>
        </div>
        <button onClick={submit} disabled={busy} className="btn-primary w-full">
          {busy ? "Menyimpan…" : "Catat Pengeluaran"}
        </button>
        {err && <p className="mt-2 text-xs font-semibold text-danger">{err}</p>}
        {msg && <p className="mt-2 text-xs font-semibold text-success">{msg}</p>}
      </div>

      {/* Filter + rekap */}
      <div className="card card-pad mb-4">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-olive">Dari</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-olive">Sampai</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-olive">Toko</span>
            <select value={storeSel} onChange={(e) => setStoreSel(e.target.value)} className="input">
              <option value="semua">Semua toko</option>
              {stores.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-600">Total periode</div>
            <div className="text-lg font-extrabold text-ink tnum">{formatRupiah(total)}</div>
          </div>
        </div>
        {byCat.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600">
            {byCat.map(([c, v]) => (
              <span key={c}>{c}: <b className="tnum text-ink">{formatRupiah(v)}</b></span>
            ))}
          </div>
        )}
      </div>

      {/* Daftar */}
      <div className="card">
        {inScope.length === 0 ? (
          <p className="p-5 text-sm text-gray-600">Belum ada pengeluaran pada periode ini.</p>
        ) : (
          inScope.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-black/5 p-3 last:border-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-xs font-bold text-danger">
                {categorizeExpense(e.description).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {e.description.replace(/^\[[^\]]+\]\s*/, "")}
                </div>
                <div className="text-xs text-gray-600">
                  {e.date} · {categorizeExpense(e.description)} · {storeName(e.storeId)} · PIC {e.pic}
                </div>
              </div>
              <b className="tnum shrink-0 text-sm text-danger">−{formatRupiah(e.amount)}</b>
              {e.photoUrl && (
                <a href={e.photoUrl} target="_blank" rel="noreferrer" className="shrink-0 text-gray-600" aria-label="Lihat foto" title="Lihat foto nota">
                  <Icon name="photo" size={16} />
                </a>
              )}
              <button
                onClick={() => del(e)}
                className="shrink-0 rounded-full bg-black/5 p-1.5 text-gray-600 hover:bg-danger/10 hover:text-danger"
                aria-label="Hapus"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
