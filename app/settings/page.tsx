"use client";

import { useSettings } from "@/store/settings";
import { useState } from "react";

export default function SettingsPage() {
  const s = useSettings();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">Pengaturan</h1>
      <div className="space-y-3 rounded-xl bg-white p-5 shadow">
        <Field label="Nama Toko">
          <input
            value={s.storeName}
            onChange={(e) => s.update({ storeName: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
          />
        </Field>
        <Field label="Alamat">
          <input
            value={s.address}
            onChange={(e) => s.update({ address: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
          />
        </Field>
        <Field label="Telepon">
          <input
            value={s.phone}
            onChange={(e) => s.update({ phone: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
          />
        </Field>
        <Field label="Nama Kasir">
          <input
            value={s.cashierName}
            onChange={(e) => s.update({ cashierName: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
          />
        </Field>
        <Field label="Pajak (%)">
          <input
            type="number"
            value={s.taxRate}
            onChange={(e) => s.update({ taxRate: Number(e.target.value) || 0 })}
            className="w-24 rounded-lg border px-3 py-2"
          />
        </Field>
        <Field label="Printer">
          <select
            value={s.printerType}
            onChange={(e) =>
              s.update({ printerType: e.target.value as typeof s.printerType })
            }
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="escpos-bluetooth">ESC/POS Bluetooth (Print Service)</option>
            <option value="browser">Browser Print</option>
            <option value="cloud">Cloud Print</option>
          </select>
        </Field>

        <button
          onClick={save}
          className="w-full rounded-lg bg-apricot px-3 py-2 font-bold text-white"
        >
          {saved ? "Tersimpan ✓" : "Simpan"}
        </button>
        <p className="text-xs text-gray-400">
          Disimpan di browser (localStorage). Nanti dipindah ke Supabase.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-olive">{label}</div>
      {children}
    </label>
  );
}
