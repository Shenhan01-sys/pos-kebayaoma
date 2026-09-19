"use client";

import { useSettings } from "@/store/settings";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { supabase } from "@/lib/supabase";
import { getPosition } from "@/lib/geo";
import { useState } from "react";
import { Icon } from "@/components/icons";

export default function SettingsPage() {
  const s = useSettings();
  const role = useAuth((a) => a.staff?.role);
  const [saved, setSaved] = useState(false);
  const stores = useData((st) => st.stores);
  const activeStoreId = useData((st) => st.activeStoreId);
  const [geoStoreId, setGeoStoreId] = useState<string>("");
  const [geoLat, setGeoLat] = useState<string>("");
  const [geoLng, setGeoLng] = useState<string>("");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);

  // E12: hanya superadmin yang bisa mengubah % pajak (fail-closed).
  const canEditTax = role === "superadmin";

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // E9: koordinat toko (DB-backed, superadmin) — dipakai geofence login 25 m.
  function pickGeoStore(id: string) {
    setGeoStoreId(id);
    setGeoMsg(null);
    const st = stores.find((t) => t.id === id);
    setGeoLat(st?.lat != null ? String(st.lat) : "");
    setGeoLng(st?.lng != null ? String(st.lng) : "");
  }
  async function captureGps() {
    setGeoMsg(null);
    setGeoBusy(true);
    try {
      const p = await getPosition();
      setGeoLat(p.lat.toFixed(6));
      setGeoLng(p.lng.toFixed(6));
      setGeoMsg("Lokasi terdeteksi — cek angkanya lalu simpan.");
    } catch (e: any) {
      setGeoMsg(e?.message ?? "Gagal mengambil GPS.");
    }
    setGeoBusy(false);
  }
  async function saveGeo() {
    setGeoMsg(null);
    if (!geoStoreId) return setGeoMsg("Pilih toko dulu.");
    const lat = parseFloat(geoLat);
    const lng = parseFloat(geoLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return setGeoMsg("Lat/Lng tidak valid.");
    setGeoBusy(true);
    const { error } = await supabase.from("stores").update({ lat, lng }).eq("id", geoStoreId);
    setGeoBusy(false);
    setGeoMsg(error ? `Gagal: ${error.message}` : "Koordinat toko tersimpan ✓");
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

      {/* E9: koordinat GPS toko — geofence login 25 m (superadmin saja, DB-backed) */}
      {role === "superadmin" && (
        <div className="card card-pad mt-4 space-y-3">
          <h2 className="text-sm font-bold text-ink">Lokasi Toko (GPS — geofence login 25 m)</h2>
          <Field label="Toko">
            <select value={geoStoreId || activeStoreId || ""} onChange={(e) => pickGeoStore(e.target.value)} className="input">
              <option value="">— Pilih toko —</option>
              {stores.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <input value={geoLat} onChange={(e) => setGeoLat(e.target.value)} className="input tnum" placeholder="-7.000000" />
            </Field>
            <Field label="Longitude">
              <input value={geoLng} onChange={(e) => setGeoLng(e.target.value)} className="input tnum" placeholder="112.000000" />
            </Field>
          </div>
          <button onClick={captureGps} disabled={geoBusy} className="btn-ghost w-full">
            <Icon name="camera" size={14} /> {geoBusy ? "Mendeteksi…" : "Ambil lokasi sekarang (berdiri di toko)"}
          </button>
          <button onClick={saveGeo} disabled={geoBusy} className="btn-primary w-full">
            Simpan Koordinat
          </button>
          {geoMsg && <p className="text-xs font-semibold text-ink">{geoMsg}</p>}
          <p className="text-xs text-gray-600">
            Aktif saat koordinat tersimpan: kasir/admin harus berada di radius 25 m dari toko saat login; superadmin/manager di luar radius tetap masuk global.
          </p>
        </div>
      )}
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
