"use client";

// components/PrintHelperControl.tsx — sakelar per perangkat: cetak lewat app pembantu "Kebaya Oma Print"
// (lib/print-helper). Aktif → nota ke RPP02N & label ke XP-D4601B langsung (Bluetooth), tanpa RawBT.
// Mati → jalur lama (nota RawBT, label dialog cetak). Hanya role lintas-toko; hanya relevan di tablet.

import { useSettings } from "@/store/settings";
import { useAuth } from "@/store/auth";
import { isAllStoreRole } from "@/lib/roles";
import { HELPER_SETTINGS_URL } from "@/lib/print-helper";

export default function PrintHelperControl() {
  const on = useSettings((s) => s.printHelper);
  const update = useSettings((s) => s.update);
  const role = useAuth((s) => s.staff?.role);
  if (!isAllStoreRole(role as never)) return null;
  return (
    <div className="relative z-10 mx-2 mb-1 rounded-2xl bg-beige px-3 py-2 text-xs text-olive">
      <button
        type="button"
        onClick={() => {
          const next = !on;
          const msg = next
            ? "Cetak lewat app \"Kebaya Oma Print\" di perangkat ini?\n\nApp harus sudah terpasang & printer nota/label sudah dipilih di app itu."
            : "Kembali cetak lewat RawBT (nota) & dialog cetak (label)?";
          if (window.confirm(msg)) update({ printHelper: next });
        }}
        className="flex w-full items-center justify-between font-semibold"
      >
        <span>Cetak via Kebaya Oma Print</span>
        <span>{on ? "AKTIF" : "Mati"}</span>
      </button>
      {on && (
        <a href={HELPER_SETTINGS_URL} className="mt-1 block underline">
          Atur printer di app
        </a>
      )}
    </div>
  );
}
