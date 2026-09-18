// E12: RBAC 4 role — superadmin / manager / admin / kasir (2026-09-18).
// Sumber keputusan: POSkebaya-Vault 07-Backlog entri E12 + flowchart per role.

import type { Role } from "@/store/data";

export type { Role };

export const ALL_PAGES = [
  "/",
  "/pos",
  "/products",
  "/inventory",
  "/customers",
  "/staff",
  "/transactions",
  "/shifts",
  "/reports",
  "/settings",
] as const;

const SUPERADMIN_PAGES: string[] = [...ALL_PAGES];
const MANAGER_PAGES = ["/", "/pos", "/products", "/inventory", "/customers", "/transactions", "/shifts", "/reports"];
const ADMIN_PAGES = ["/", "/transactions", "/reports"];
const KASIR_PAGES = ["/", "/pos", "/inventory", "/customers", "/transactions", "/shifts"];

export function pagesForRole(role: Role | undefined | null): string[] {
  switch (role) {
    case "superadmin":
      return SUPERADMIN_PAGES;
    case "manager":
      return MANAGER_PAGES;
    case "admin":
      return ADMIN_PAGES;
    case "kasir":
      return KASIR_PAGES;
    default:
      return []; // role tak dikenal / belum termuat = tidak ada akses (fail-closed)
  }
}

export function canAccessPage(role: Role | undefined | null, href: string): boolean {
  return pagesForRole(role).includes(href);
}

/** Laba/HPP/margin/% untung — superadmin saja (v1 FE-only; v2 column-level RLS = U2). */
export function canSeeProfit(role: Role | undefined | null): boolean {
  return role === "superadmin";
}

/** Tulis stok (restock/adjust/seed) — superadmin + manager (paritas RPC `can_manage_stock`). */
export function canManageStock(role: Role | undefined | null): boolean {
  return role === "superadmin" || role === "manager";
}

/** Batal/refund transaksi — superadmin + manager. */
export function canManageTransactions(role: Role | undefined | null): boolean {
  return role === "superadmin" || role === "manager";
}

/** Switcher toko "Semua" — role lintas-toko (storeId NULL di akun). */
export function isAllStoreRole(role: Role | undefined | null): boolean {
  return role === "superadmin" || role === "manager" || role === "admin";
}

/** Role yang boleh CRUD staff (API guard DB `is_store_admin` = superadmin). */
export function canManageStaff(role: Role | undefined | null): boolean {
  return role === "superadmin";
}

/** Role lintas-toko utk keperluan form staff (store_id NULL diizinkan). */
export const ALL_STORE_ROLES: Role[] = ["superadmin", "manager", "admin"];
