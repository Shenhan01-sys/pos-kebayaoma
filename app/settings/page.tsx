"use client";

import { useSettings } from "@/store/settings";
import { useAuth } from "@/store/auth";
import { useState } from "react";
import { Icon } from "@/components/icons";

export default function SettingsPage() {
  const s = useSettings();
  const role = useAuth((a) => a.staff?.role);
  const [saved, setSaved] = useState(false);

  // E12: hanya superadmin yang bisa mengubah % pajak (fail-closed).
  const canEditTax = role === "superadmin";

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-ink">Pengaturan</h1>
      <div className="card card-pad space-y-3">
        <Field label="Nama Toko">
          <input value={s.storeName} onChange={(e) => s.update({ storeName: e.target.value })} className="input" />
        </Field>
        <Field label="Alamat">
          <input value={s.address} onChange={(e) => s.update({ address: e.target.value })} className="input" />
        </Field>
        <Field label="Telepon">
          <input value={s.phone} onChange={(e) => s.update({ phone: e.target.value })} className="input" />
        </Field>
        <Field label="Nama Kasir">
          <input value={s.cashierName} onChange={(e) => s.update({ cashierName: e.target.value })} className="input" />
        </Field>
        <Field label="Printer">
          <select
            value={s.printerType}
            onChange={(e) => s.update({ printerType: e.target.value as typeof s.printerType })}
            className="input"
          >
            <option value="escpos-bluetooth">ESC/POS Bluetooth (Print Service)</option>
            <option value="browser">Browser Print</option>
            <option value="cloud">Cloud Print</option>
          </select>
        </Field>

        <Field label="Pajak (%) — harga sudah termasuk pajak">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={s.taxRate}
            onChange={(e) => canEditTax && s.update({ taxRate: Math.max(0, Number(e.target.value) || 0) })}
            className="input disabled:opacity-50"
            disabled={!canEditTax}
          />
          {!canEditTax && <p className="mt-1 text-xs text-gray-500">Hanya manajer yang dapat mengubah pajak.</p>}
          <p className="mt-1 text-xs text-gray-600">
            Model inclusive: harga label = harga bayar. Pajak ini hanya menghitung keterangan PPN tersirat di struk.
          </p>
        </Field>

        <button onClick={save} className="btn-primary w-full py-3">
          {saved ? <><Icon name="check" size={16} /> Tersimpan</> : "Simpan"}
        </button>
        <p className="text-xs text-gray-600">
          Disimpan di browser (localStorage). Nanti dipindah ke Supabase.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-olive">{label}</div>
      {children}
    </label>
  );
}
