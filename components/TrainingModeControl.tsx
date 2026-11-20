"use client";

// components/TrainingModeControl.tsx — Mode Latihan (2026-11-20, permintaan user setelah uji coba di toko
// MJ masuk ke data produksi): checkout disimulasikan di perangkat ini — tidak ada transaksi, stok, nomor nota,
// atau laporan yang berubah; nota tetap tercetak bertanda LATIHAN. Hanya role lintas-toko yang boleh
// menyalakan/mematikan; banner (TrainingModeBanner) tampil untuk semua selama aktif.

import { useSettings } from "@/store/settings";
import { useAuth } from "@/store/auth";
import { isAllStoreRole } from "@/lib/roles";

export function TrainingModeBanner() {
  const on = useSettings((s) => s.trainingMode);
  if (!on) return null;
  return (
    <div className="mb-3 rounded-2xl bg-orange-500 px-4 py-2 text-center text-sm font-bold text-white">
      MODE LATIHAN — transaksi tidak disimpan · stok, nomor nota &amp; laporan tidak berubah
    </div>
  );
}

export default function TrainingModeControl() {
  const on = useSettings((s) => s.trainingMode);
  const update = useSettings((s) => s.update);
  const role = useAuth((s) => s.staff?.role);
  if (!isAllStoreRole(role as never)) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        const msg = next
          ? "Nyalakan MODE LATIHAN di perangkat ini?\n\nCheckout tidak akan disimpan (stok, nomor nota, laporan tidak berubah). Nota tetap tercetak bertanda LATIHAN."
          : "Matikan MODE LATIHAN? Transaksi berikutnya kembali tersimpan sungguhan.";
        if (window.confirm(msg)) update({ trainingMode: next });
      }}
      className={`relative z-10 mx-2 mb-1 flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold ${
        on ? "bg-orange-500 text-white" : "bg-beige text-olive"
      }`}
    >
      <span>Mode Latihan</span>
      <span>{on ? "AKTIF" : "Mati"}</span>
    </button>
  );
}
