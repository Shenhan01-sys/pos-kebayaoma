"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSettings } from "@/store/settings";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/pos", label: "Kasir POS" },
  { href: "/products", label: "Produk" },
  { href: "/inventory", label: "Inventori" },
  { href: "/customers", label: "Pelanggan" },
  { href: "/staff", label: "Staff" },
  { href: "/transactions", label: "Transaksi" },
  { href: "/shifts", label: "Shift" },
  { href: "/reports", label: "Laporan" },
  { href: "/settings", label: "Pengaturan" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const s = useSettings();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
      {links.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-olive" : "hover:bg-brand-800"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — static on lg, drawer on smaller */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-violet text-beige transform transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-3 py-4 text-lg font-bold leading-tight">
          {s.storeName.split(" ")[0]}
          <span className="text-apricot">
            {s.storeName.split(" ").slice(1).join(" ")}
          </span>
          <div className="text-[10px] font-normal text-custard">POS Tablet</div>
        </div>
        {nav}
        <div className="px-3 py-3 text-xs text-custard border-t border-brand-800">
          Kasir: <span className="text-white">{s.cashierName}</span>
          <div className="mt-1 inline-block rounded bg-green-600 px-1.5 py-0.5 text-[10px]">
            Shift Buka
          </div>
        </div>
      </aside>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 bg-violet px-3 py-3 text-beige md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="text-xl leading-none"
            aria-label="Buka menu"
          >
            ☰
          </button>
          <span className="font-bold">{s.storeName}</span>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
