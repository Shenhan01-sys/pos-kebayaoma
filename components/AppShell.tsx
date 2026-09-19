"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSettings } from "@/store/settings";
import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import { isSupabaseReady } from "@/lib/supabase";
import { Icon, type IconName } from "@/components/icons";
import LoadingScreen from "@/components/LoadingScreen";
import LoginScreen from "@/components/LoginScreen";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/pos", label: "Kasir POS", icon: "pos" },
  { href: "/products", label: "Produk", icon: "products" },
  { href: "/inventory", label: "Inventori", icon: "inventory" },
{ href: "/customers", label: "Pelanggan", icon: "customers" },
{ href: "/expenses", label: "Petty Cash", icon: "wallet" },
{ href: "/staff", label: "Staff", icon: "staff" },
  { href: "/transactions", label: "Transaksi", icon: "transactions" },
  { href: "/shifts", label: "Shift", icon: "shifts" },
  { href: "/reports", label: "Laporan", icon: "reports" },
  { href: "/settings", label: "Pengaturan", icon: "settings" },
];

// E12: RBAC 4 role — halaman per role dari lib/roles.ts (fail-closed).
import { canAccessPage, isAllStoreRole } from "@/lib/roles";

function canAccess(href: string, role?: string) {
  return canAccessPage(role as never, href);
}

const PUBLIC_PREFIXES = ["/product/"];

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Pemilih scope toko — hanya untuk manager lintas-toko (storeId null).
// Staff terkunci tidak melihat ini; scope mereka ikut akun login.
function StoreSwitcher() {
  const staff = useAuth((a) => a.staff);
  const stores = useData((s) => s.stores);
  const activeStoreId = useData((s) => s.activeStoreId);
  if (!isAllStoreRole(staff?.role as never) || staff?.storeId !== null) return null;
  if (stores.length === 0) return null;
  const set = (id: string | null) => useData.getState().setActiveStore(id);
  const btn = (label: string, id: string | null, isActive: boolean) => (
    <button
      key={label}
      onClick={() => set(id)}
      className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition ${
        isActive ? "bg-violet text-white shadow-soft" : "text-olive hover:bg-black/5"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="relative z-10 mx-2 mb-1 rounded-2xl bg-beige p-2">
      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-olive">
        Toko: {activeStoreId === null ? "Semua" : stores.find((t) => t.id === activeStoreId)?.prefix ?? "…"}
      </div>
      <div className="flex gap-1">
        {btn("Semua", null, activeStoreId === null)}
        {stores.map((t) => btn(t.prefix, t.id, activeStoreId === t.id))}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const s = useSettings();
  const auth = useAuth();
  const [open, setOpen] = useState(false);

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // RBAC E12: redirect semua role dari halaman yang tidak diizinkan (fail-closed)
  useEffect(() => {
    const role = auth.staff?.role;
    if (role && !isPublic && !canAccess(pathname, role)) {
      router.replace(canAccessPage(role as never, "/pos") ? "/pos" : "/");
    }
  }, [auth.staff?.role, pathname, isPublic, router]);

  // Init auth (session + staff profile)
  useEffect(() => {
    useAuth.getState().init();
  }, []);

  // E14: JANGAN fetch data di sini — auth.init() -> syncStoreScope() sudah mem-fetch
  // semua koleksi SEKALI dengan scope toko yang benar. Fetch manual di mount duluan
  // menyebabkan semua query berjalan dobel (lihat FE6 #33 / backlog E14).
  useEffect(() => {
    if (!isSupabaseReady) {
      useData.getState().loadFallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-subscribe realtime saat scope toko berubah (filter store_id per toko).
  const activeStoreId = useData((s) => s.activeStoreId);
  useEffect(() => {
    if (!isSupabaseReady || !auth.initialized) return;
    const unsub = useData.getState().subscribeRealtime();
    return () => { if (typeof unsub === "function") unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId, auth.initialized]);

  const products = useData((s) => s.products);
  const lowCount = products.filter((p) => p.stock <= 5).length;

  // Public pages (e.g. product profile from QR label) render without shell/login
  if (isPublic) {
    return (
      <div className="min-h-screen bg-beige/40">
        <LoadingScreen />
        {children}
      </div>
    );
  }

  if (!auth.initialized) return <LoadingScreen />;
  if (!auth.session && !auth.staff) return <LoginScreen />;

  const nav = (
    <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto pretty-scroll px-2 py-2">
      {links.filter((l) => canAccess(l.href, auth.staff?.role)).map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-custard text-ink shadow-soft"
                : "text-ink/70 hover:bg-black/5 hover:text-ink"
            }`}
          >
            <Icon name={l.icon} size={19} className={active ? "text-apricot" : "text-olive"} />
            <span>{l.label}</span>
            {l.href === "/inventory" && lowCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold leading-none text-white">
                {lowCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <LoadingScreen />
      {/* Sidebar — floating light panel on desktop, drawer on small screens */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col p-3 transition-transform duration-200 md:sticky md:top-0 md:bottom-auto md:h-[100dvh] md:self-start md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex h-full w-60 flex-col overflow-hidden rounded-[28px] bg-white p-3 shadow-soft-lg ring-1 ring-black/5">
          {/* Decorative solid blobs */}
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-apricot/10" />
          <div className="pointer-events-none absolute -left-8 top-1/3 h-28 w-28 rounded-full bg-violet/5" />

          <div className="relative z-10 flex items-center gap-3 px-3 pb-3 pt-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet text-lg shadow-soft">
              🪡
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold text-ink">
                {s.storeName.split(" ")[0]}
                <span className="text-apricot">
                  {" "}
                  {s.storeName.split(" ").slice(1).join(" ")}
                </span>
              </div>
              <div className="text-[10px] font-medium text-olive">POS Tablet</div>
            </div>
          </div>

          {nav}

          <StoreSwitcher />
          <div className="relative z-10 m-2 flex items-center gap-3 rounded-2xl bg-beige p-2.5">
            <div className="avatar h-9 w-9 bg-violet">
              {initials(auth.staff?.name ?? s.cashierName)}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-bold text-ink">
                {auth.staff?.name ?? s.cashierName}
              </div>
              <div className="text-[10px] text-olive">
                {auth.staff ? `${auth.staff.role} · kasir aktif` : "Kasir aktif"}
              </div>
            </div>
            <button
              onClick={() => useAuth.getState().logout()}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-olive shadow-soft transition hover:text-danger"
              aria-label="Keluar"
              title="Keluar"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-black/5 bg-white/70 px-3 py-2.5 backdrop-blur-md md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink"
            aria-label="Buka menu"
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="font-bold text-ink">{s.storeName}</span>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-5">
          {!isSupabaseReady && (
            <div className="mb-3 rounded-2xl bg-apricot/10 px-4 py-2 text-xs font-medium text-olive">
              Mode Demo: data disimpan lokal di browser ini. Hubungkan Supabase untuk produksi.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
