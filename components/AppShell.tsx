"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-44 shrink-0 flex-col bg-violet text-beige">
        <div className="px-3 py-4 text-lg font-bold leading-tight">
          {s.storeName.split(" ")[0]}
          <span className="text-apricot">
            {s.storeName.split(" ").slice(1).join(" ")}
          </span>
          <div className="text-[10px] font-normal text-custard">POS Tablet</div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-olive" : "hover:bg-brand-800"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 text-xs text-custard border-t border-brand-800">
          Kasir: <span className="text-white">{s.cashierName}</span>
          <div className="mt-1 inline-block rounded bg-green-600 px-1.5 py-0.5 text-[10px]">
            Shift Buka
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}
