"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Role, Staff } from "@/store/data";
import { useAuth } from "@/store/auth";
import { Icon } from "@/components/icons";

const roleLabel: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  cashier: "Kasir",
};

const rolePill: Record<Role, string> = {
  admin: "pill-violet",
  manager: "pill-apricot",
  cashier: "pill-muted",
};

const initials = (n: string) =>
  n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const PAD: (string | "back")[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("staff")
      .select("id, name, role, phone, active")
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) setStaffList(data as Staff[]);
      });
  }, []);

  const submit = async (value: string) => {
    if (!selected || value.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    const err = await login(selected.id, value);
    setBusy(false);
    if (err) {
      setError(err);
      setPin("");
      return;
    }
    router.replace("/");
  };

  const key = (k: string | "back") => {
    setError(null);
    if (k === "back") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length >= 6 ? p : p + k));
  };

  const pad = useMemo(() => {
    if (!selected || !selected.name) return "";
    return `${selected.name} · ${roleLabel[selected.role]}`;
  }, [selected]);

  if (selected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-grad-cream p-6">
        <div className="w-full max-w-[340px]">
          <button
            onClick={() => { setSelected(null); setPin(""); setError(null); }}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-olive hover:text-ink"
          >
            <Icon name="arrow-left" size={16} /> Ganti kasir
          </button>

          <div className="card card-pad mb-5 flex items-center gap-3">
            <span className="avatar h-12 w-12 bg-grad-violet">{initials(selected.name)}</span>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold text-ink">{selected.name}</div>
              <div className={`pill ${rolePill[selected.role]}`}>{roleLabel[selected.role]}</div>
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
                  className="h-16 rounded-2xl bg-white text-xl font-extrabold text-ink shadow-soft ring-1 ring-black/5 transition active:scale-95 active:bg-beige"
                >
                  {k === "back" ? <Icon name="backspace" size={22} /> : k}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => submit(pin)}
            disabled={pin.length < 4 || busy}
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
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-violet text-2xl shadow-soft-lg">
          🪡
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Kebaya Oma POS</h1>
        <p className="mt-1 text-sm text-olive">Pilih kasir untuk memulai shift</p>
      </div>

      <div className="grid w-full max-w-[420px] grid-cols-2 gap-3">
        {staffList.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="card card-pad flex flex-col items-start gap-2 text-left transition hover:-translate-y-0.5 hover:shadow-soft-lg"
          >
            <span className="avatar h-11 w-11 bg-grad-violet">{initials(s.name)}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-ink">{s.name}</div>
              <div className={`pill ${rolePill[s.role]}`}>{roleLabel[s.role]}</div>
            </div>
          </button>
        ))}
      </div>

      {staffList.length === 0 && (
        <p className="text-sm text-gray-500">Belum ada staff aktif. Hubungi admin.</p>
      )}
    </div>
  );
}
