"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { Role, Staff } from "@/store/data";
import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import { evaluateGeofence, getPosition } from "@/lib/geo";
import { Icon } from "@/components/icons";

const roleLabel: Record<Role, string> = {
  superadmin: "Superadmin",
  manager: "Manager",
  admin: "Admin",
  kasir: "Kasir",
};

const rolePill: Record<Role, string> = {
  superadmin: "pill-violet",
  manager: "pill-violet",
  admin: "pill-apricot",
  kasir: "pill-muted",
};

const initials = (n: string) =>
  n.split(" ").filter(Boolean).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();

const PAD: (string | "back")[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function LoginScreen() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [username, setUsername] = useState("");
const [selected, setSelected] = useState<Staff | null>(null);
const [pin, setPin] = useState("");
const [showGeoNotice, setShowGeoNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // E9: popup penjelasan geofence ditampilkan ulang setelah login ditolak (remount)
    if (sessionStorage.getItem("geo_notice") === "1") {
      sessionStorage.removeItem("geo_notice");
      setShowGeoNotice(true);
    }
    if (!isSupabaseReady) {
      const dataStaff = useData.getState().staff;
      if (dataStaff.length > 0) {
        setStaffList(dataStaff.filter((s) => s.active));
        return;
      }
      useData.getState().loadFallback();
      setStaffList(useData.getState().staff.filter((s) => s.active));
      return;
    }
    supabase
      .from("staff")
      .select("id, name, role, phone, active, store_id")
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) {
          setStaffList(
            (data as any[]).map((r) => ({ ...r, storeId: r.store_id ?? null })) as Staff[]
          );
        }
      });
    useData.getState().fetchStores();
  }, []);
  const storePrefixOf = (id: string | null) => {
    if (id === null || id === undefined) return "Semua";
    return useData.getState().stores.find((t) => t.id === id)?.prefix ?? "";
  };

  function handleNext() {
    setError(null);
    const input = username.trim().toLowerCase();
    if (!input) {
      setError("Masukkan username terlebih dahulu.");
      return;
    }
    const match = staffList.find(
      (s) =>
        s.name.toLowerCase() === input ||
        s.id.toLowerCase() === input ||
        s.name.toLowerCase().includes(input)
    );
    if (!match) {
      setError("Username tidak ditemukan atau tidak aktif.");
      return;
    }
    setSelected(match);
    setPin("");
    // E9: popup geofence muncul SETELAH PIN diperiksa (saat lokasi di luar radius) — bukan di sini
  }

  const submit = async (value: string) => {
    if (!selected || value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const err = await login(selected.id, value);
    if (err) {
      setBusy(false);
      setError(err);
      setPin("");
      return;
    }
    // E9: geofence login — kasir/admin wajib dalam radius 25 m toko; superadmin/manager
    // di luar radius → global. Fail-open bila belum ada toko ber-koordinat.
    try {
      const stores = useData.getState().stores.map((s) => ({
        id: s.id, name: s.name, lat: s.lat ?? null, lng: s.lng ?? null,
      }));
      let configured = stores.filter((s) => s.lat != null && s.lng != null);
      if (configured.length === 0) {
        // state belum termuat (E14: fetch pasca-login) — ambil langsung dari DB
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase
          .from("stores")
          .select("id, name, lat, lng")
          .not("lat", "is", null);
        configured = (data ?? []) as typeof configured;
      }
      if (configured.length > 0) {
        const pos = await getPosition();
        const res = evaluateGeofence(selected.role, configured, pos);
        if (res.kind === "blocked") {
          // flag → LoginScreen yang di-remount pasca logout tetap menampilkan popup penjelasan
          sessionStorage.setItem("geo_notice", "1");
          await logout();
          setBusy(false);
          setError(res.message);
          setPin("");
          return;
        }
        if (res.kind === "ok" && res.storeId) {
          useData.getState().setActiveStore(res.storeId);
        }
      }
    } catch (e: any) {
      // GPS gagal: role toko → tolak (aturan user); superadmin/manager → lanjut global
      const needsPresence = selected.role === "kasir" || selected.role === "admin";
      if (needsPresence) {
        sessionStorage.setItem("geo_notice", "1");
        await logout();
        setBusy(false);
        setError(e?.message ?? "Gagal mendeteksi lokasi.");
        setPin("");
        return;
      }
    }
    setBusy(false);
    router.replace("/");
  };

  const key = (k: string | "back") => {
    setError(null);
    if (k === "back") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length >= 6 ? p : p + k));
  };

  // E9: popup geofence — render di KEDUA layar (username & PIN) supaya tetap tampil
  // setelah login ditolak dan LoginScreen balik ke pilih nama.
  const geoNoticeEl = showGeoNotice ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
      <div className="card w-full max-w-[340px] p-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-apricot/20 text-2xl">📍</div>
        <div className="mb-1 text-base font-extrabold text-ink">Login harus di dalam toko</div>
        <p className="text-sm text-gray-600">
          Akun <b className="text-ink">Kasir/Admin</b> hanya bisa login saat berada di
          radius <b className="text-ink">25 m</b> dari outlet ({useData.getState().stores.map((t) => t.name).join(" / ") || "outlet"}).
          Pastikan <b className="text-ink">GPS aktif</b> dan izin lokasi browser diizinkan.
        </p>
        <button
          onClick={() => setShowGeoNotice(false)}
          className="btn-primary mt-4 w-full"
        >
          Oke, mengerti
        </button>
      </div>
    </div>
  ) : null;

  if (selected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-grad-cream p-6">
        {geoNoticeEl}
        <div className="w-full max-w-[340px]">
          <button
            onClick={() => { setSelected(null); setPin(""); setError(null); setUsername(""); }}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-olive hover:text-ink"
          >
            <Icon name="arrow-left" size={16} /> Ganti kasir
          </button>

          <div className="card card-pad mb-5 flex items-center gap-3">
            <span className="avatar h-12 w-12 bg-grad-violet">{initials(selected.name)}</span>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold text-ink">{selected.name}</div>
              <div className="flex items-center gap-1.5">
                <div className={`pill ${rolePill[selected.role]}`}>{roleLabel[selected.role]}</div>
                <div className="pill pill-soft">{storePrefixOf(selected.storeId)}</div>
              </div>
            </div>
          </div>

          <div className="card card-pad mb-4 text-center">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-olive">Masukkan PIN</div>
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-apricot" : "bg-black/10"}`}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl bg-danger/10 px-4 py-2.5 text-center text-sm font-semibold text-danger">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            {PAD.map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  onClick={() => key(k)}
                  className="flex h-16 items-center justify-center rounded-2xl bg-white text-xl font-extrabold text-ink shadow-soft ring-1 ring-black/5 transition active:scale-95 active:bg-beige"
                >
                  {k === "back" ? <span className="text-2xl leading-none">⌫</span> : k}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => submit(pin)}
            disabled={pin.length !== 6 || busy}
            className="btn-violet mt-4 w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Memeriksa…" : `Masuk sebagai ${selected.name}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-grad-cream p-6">
      {geoNoticeEl}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-violet text-2xl shadow-soft-lg">
          🪡
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Kebaya Oma POS</h1>
        <p className="mt-1 text-sm text-olive">Masuk untuk memulai shift</p>
      </div>

      <div className="w-full max-w-[340px]">
        <label className="mb-1.5 block text-sm font-semibold text-olive">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
          placeholder="Masukkan nama / username"
          className="input mb-2"
          autoFocus
        />

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">
            <Icon name="alert" size={16} />
            {error}
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={!username.trim()}
          className="btn-violet w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lanjut
          <Icon name="arrow-left" size={18} className="ml-2 rotate-180" />
        </button>
      </div>
    </div>
  );
}
