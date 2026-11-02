"use client";

import { useSettings } from "@/store/settings";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { supabase } from "@/lib/supabase";
import { getPosition } from "@/lib/geo";
import { useEffect, useState } from "react";
import { lateFee } from "@/lib/rental";
import { formatRupiah } from "@/lib/dummy";
import dynamic from "next/dynamic";
import { Icon } from "@/components/icons";

// E9: peta Leaflet — dynamic import (SSR off), bundle halaman tetap ramping.
const StoreMap = dynamic(() => import("@/components/StoreMap"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-2xl bg-beige" />,
});

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
  const [mapOpen, setMapOpen] = useState(false);

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
        <Field label="Alamat (cadangan perangkat ini — alamat nota per toko diatur di kartu bawah)">
          <input value={s.address} onChange={(e) => s.update({ address: e.target.value })} className="input" />
        </Field>
        <Field label="Telepon (cadangan perangkat ini)">
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
          <button
            onClick={() => setMapOpen((v) => !v)}
            className="btn-ghost w-full"
          >
            {mapOpen ? "Tutup peta" : "Pilih titik di peta"}
          </button>
          {mapOpen && (
            <div className="dynamic-import">
              <StoreMap
                lat={geoLat !== "" ? parseFloat(geoLat) : null}
                lng={geoLng !== "" ? parseFloat(geoLng) : null}
                onPick={(la, ln) => {
                  setGeoLat(la.toFixed(6));
                  setGeoLng(ln.toFixed(6));
                  setGeoMsg("Titik dipilih di peta — tekan Simpan Koordinat.");
                }}
              />
              <p className="mt-1 text-xs text-gray-600">Klik peta untuk menandai titik lokasi toko.</p>
            </div>
          )}
          <button onClick={saveGeo} disabled={geoBusy} className="btn-primary w-full">
            Simpan Koordinat
          </button>
          {geoMsg && <p className="text-xs font-semibold text-ink">{geoMsg}</p>}
          <p className="text-xs text-gray-600">
            Aktif saat koordinat tersimpan: kasir/admin harus berada di radius 25 m dari toko saat login; superadmin/manager di luar radius tetap masuk global.
          </p>
        </div>
      )}

      {/* E29/E30: alamat nota + denda telat sewa per toko (DB, superadmin) */}
      {role === "superadmin" && <StoreReceiptCard />}
    </div>
  );
}

function StoreReceiptCard() {
  const stores = useData((st) => st.stores);
  const activeStoreId = useData((st) => st.activeStoreId);
  const fetchStores = useData((st) => st.fetchStores);
  const [pick, setPick] = useState("");
  const sid = pick || activeStoreId || stores[0]?.id || "";
  const cur = stores.find((t) => t.id === sid);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [base, setBase] = useState("0");
  const [step, setStep] = useState("0");
  const [msgAddr, setMsgAddr] = useState<string | null>(null);
  const [msgFee, setMsgFee] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // muat nilai toko terpilih ke form tiap ganti toko / setelah data toko dimuat ulang
  useEffect(() => {
    setAddress(cur?.address ?? "");
    setPhone(cur?.phone ?? "");
    setBase(String(cur?.lateFeeBase ?? 0));
    setStep(String(cur?.lateFeeStep ?? 0));
  }, [sid, cur?.address, cur?.phone, cur?.lateFeeBase, cur?.lateFeeStep]);

  async function saveAddress() {
    if (!sid || busy) return;
    setBusy(true);
    setMsgAddr(null);
    const { error } = await supabase.from("stores").update({ address: address.trim() || null, phone: phone.trim() || null }).eq("id", sid);
    if (!error) await fetchStores();
    setBusy(false);
    setMsgAddr(error ? `Gagal: ${error.message}` : "Alamat nota tersimpan ✓ (tampil di semua perangkat toko ini)");
  }
  async function saveFee() {
    if (!sid || busy) return;
    const b = Math.max(0, Number(base) || 0);
    const st = Math.max(0, Number(step) || 0);
    setBusy(true);
    setMsgFee(null);
    const { error } = await supabase.from("stores").update({ late_fee_base: b, late_fee_step: st }).eq("id", sid);
    if (!error) await fetchStores();
    setBusy(false);
    setMsgFee(error ? `Gagal: ${error.message}` : "Denda telat tersimpan ✓");
  }

  const cfg = { base: Number(base) || 0, step: Number(step) || 0 };
  return (
    <div className="card card-pad mt-4 space-y-3">
      <h2 className="text-sm font-bold text-ink">Alamat Nota &amp; Denda Sewa (per toko)</h2>
      <Field label="Toko">
        <select value={sid} onChange={(e) => { setPick(e.target.value); setMsgAddr(null); setMsgFee(null); }} className="input">
          {stores.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Alamat di nota">
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" placeholder="mis. Jl. Pahlawan No. 10, Majalengka" />
      </Field>
      <Field label="Telepon di nota">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="mis. 0812-xxxx-xxxx" />
      </Field>
      <button onClick={saveAddress} disabled={busy || !sid} className="btn-primary w-full disabled:opacity-50">Simpan Alamat Nota</button>
      {msgAddr && <p className="text-xs font-semibold text-ink">{msgAddr}</p>}

      <div className="border-t border-black/5 pt-3" />
      <h3 className="text-sm font-bold text-ink">Denda telat sewa</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Denda hari ke-1 (Rp)">
          <input inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value.replace(/[^\d]/g, ""))} className="input tnum" />
        </Field>
        <Field label="Tambah per hari berikutnya (Rp)">
          <input inputMode="numeric" value={step} onChange={(e) => setStep(e.target.value.replace(/[^\d]/g, ""))} className="input tnum" />
        </Field>
      </div>
      <p className="text-xs text-gray-600">
        Denda hari ke-n = hari ke-1 + (n−1) × tambahan, jadi makin lama telat makin besar. Berlaku per sewa (bukan per unit). Isi 0 untuk mematikan denda.
      </p>
      {cfg.base + cfg.step > 0 && (
        <div className="rounded-2xl bg-beige/60 px-3 py-2 text-xs text-olive">
          Contoh total: {[1, 2, 3, 5, 7].map((d) => `${d} hari ${formatRupiah(lateFee(d, cfg))}`).join(" · ")}
        </div>
      )}
      <button onClick={saveFee} disabled={busy || !sid} className="btn-primary w-full disabled:opacity-50">Simpan Denda</button>
      {msgFee && <p className="text-xs font-semibold text-ink">{msgFee}</p>}
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
