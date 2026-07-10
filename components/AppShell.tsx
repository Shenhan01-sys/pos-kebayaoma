"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSettings } from "@/store/settings";
import { Icon, type IconName } from "@/components/icons";
import LoadingScreen from "@/components/LoadingScreen";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/pos", label: "Kasir POS", icon: "pos" },
  { href: "/products", label: "Produk", icon: "products" },
  { href: "/inventory", label: "Inventori", icon: "inventory" },
  { href: "/customers", label: "Pelanggan", icon: "customers" },
  { href: "/staff", label: "Staff", icon: "staff" },
  { href: "/transactions", label: "Transaksi", icon: "transactions" },
  { href: "/shifts", label: "Shift", icon: "shifts" },
  { href: "/reports", label: "Laporan", icon: "reports" },
  { href: "/settings", label: "Pengaturan", icon: "settings" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const s = useSettings();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto pretty-scroll px-2 py-2">
      {links.map((l) => {
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col p-3 transition-transform duration-200 md:static md:translate-x-0 ${
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

          <div className="relative z-10 m-2 flex items-center gap-3 rounded-2xl bg-beige p-2.5">
            <div className="avatar h-9 w-9 bg-violet">{initials(s.cashierName)}</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-bold text-ink">{s.cashierName}</div>
              <div className="text-[10px] text-olive">Kasir aktif</div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Shift
            </span>
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

        <main className="flex-1 overflow-auto p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
