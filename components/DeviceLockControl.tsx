"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { getPosition } from "@/lib/geo";
import {
  canManageDeviceLock,
  clearDeviceLock,
  readDeviceLock,
  resolveGpsLock,
  writeDeviceLock,
  type DeviceLock,
} from "@/lib/device-lock";

// Kunci lokasi tablet (sidebar). Semua role melihat statusnya; hanya role lintas-toko
// (superadmin/manager/admin) yang bisa mengunci (manual / scan GPS) dan membuka kunci.
export default function DeviceLockControl() {
  const staff = useAuth((a) => a.staff);
  const stores = useData((s) => s.stores);
  const [lock, setLock] = useState<DeviceLock | null>(null);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  useEffect(() => {
    setLock(readDeviceLock());
  }, []);

  if (!staff) return null;
  const canManage = canManageDeviceLock(staff.role as never);
  const label = (id: string) => {
    const s = stores.find((t) => t.id === id);
    return s ? s.prefix || s.name : "toko ?";
  };

  function applyLock(storeId: string, method: DeviceLock["method"]) {
    const next: DeviceLock = { storeId, lockedAt: new Date().toISOString(), by: staff!.name, method };
    writeDeviceLock(next);
    setLock(next);
    useData.getState().setActiveStore(storeId);
    setMsg(null);
  }

  function lockManual() {
    if (!pick) return setMsg("Pilih toko dulu.");
    applyLock(pick, "manual");
  }

  async function lockGps() {
    setBusy(true);
    setMsg(null);
    try {
      const pos = await getPosition();
      const res = resolveGpsLock(pos, stores);
      if (res.ok) applyLock(res.store.id, "gps");
      else setMsg(res.message);
    } catch (e: any) {
      setMsg(e?.message ?? "Gagal mendeteksi lokasi.");
    }
    setBusy(false);
  }

  function unlock() {
    if (!confirmUnlock) {
      setConfirmUnlock(true);
      setTimeout(() => setConfirmUnlock(false), 4000);
      return;
    }
    clearDeviceLock();
    setLock(null);
    setConfirmUnlock(false);
    setMsg("Kunci dibuka — login berikutnya memakai GPS lagi.");
  }

  return (
    <div className="relative z-10 mx-2 mb-1 rounded-2xl bg-beige p-2">
      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-olive">Kunci tablet</div>
      {lock ? (
        <div className="px-1 text-[11px] text-ink">
          🔒 Terkunci ke <b>{label(lock.storeId)}</b>
          <span className="text-gray-500"> · {lock.method === "gps" ? "via GPS" : "manual"}{lock.by ? ` · ${lock.by}` : ""}</span>
        </div>
      ) : (
        <div className="px-1 text-[11px] text-gray-600">Belum dikunci — login memakai GPS.</div>
      )}

      {canManage && lock && (
        <button onClick={unlock} className="mt-1.5 w-full rounded-xl px-2 py-1.5 text-[11px] font-bold text-danger ring-1 ring-danger/30 hover:bg-danger/5">
          {confirmUnlock ? "Ketuk lagi untuk membuka kunci" : "Buka kunci"}
        </button>
      )}

      {canManage && !lock && (
        <div className="mt-1.5 space-y-1.5">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="input !py-1 text-[11px]" aria-label="Toko untuk dikunci">
            <option value="">— pilih toko —</option>
            {stores.map((t) => (
              <option key={t.id} value={t.id}>{t.prefix} - {t.name}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button onClick={lockManual} disabled={busy || !pick} className="flex-1 rounded-xl bg-violet px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
              Kunci
            </button>
            <button onClick={lockGps} disabled={busy} className="flex-1 rounded-xl px-2 py-1.5 text-[11px] font-bold text-olive ring-1 ring-black/10 hover:bg-black/5 disabled:opacity-40">
              {busy ? "Scan…" : "Scan GPS"}
            </button>
          </div>
        </div>
      )}
      {msg && <p className="mt-1.5 px-1 text-[10px] font-semibold text-ink">{msg}</p>}
    </div>
  );
}
