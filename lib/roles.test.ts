import { describe, it, expect } from "vitest";
import {
  pagesForRole,
  canAccessPage,
  canSeeProfit,
  canManageStock,
  canManageTransactions,
  isAllStoreRole,
  canManageStaff,
} from "./roles";

describe("E12 RBAC roles", () => {
  it("pagesForRole: superadmin = semua halaman", () => {
    expect(pagesForRole("superadmin")).toContain("/settings");
    expect(pagesForRole("superadmin")).toContain("/staff");
    expect(pagesForRole("superadmin")).toContain("/reports");
    expect(pagesForRole("superadmin").length).toBe(10);
  });

  it("pagesForRole: manager tanpa /staff & /settings, dengan /reports & /inventory", () => {
    const p = pagesForRole("manager");
    expect(p).toContain("/reports");
    expect(p).toContain("/inventory");
    expect(p).not.toContain("/staff");
    expect(p).not.toContain("/settings");
  });

  it("pagesForRole: admin = Dashboard/Transaksi/Laporan saja", () => {
    expect(pagesForRole("admin")).toEqual(["/", "/transactions", "/reports"]);
  });

  it("pagesForRole: kasir = POS/Inventori/Transaksi, tanpa Produk/Laporan", () => {
    const p = pagesForRole("kasir");
    expect(p).toContain("/pos");
    expect(p).toContain("/inventory");
    expect(p).not.toContain("/products");
    expect(p).not.toContain("/reports");
  });

  it("fail-closed: role tidak dikenal = tidak ada akses", () => {
    expect(pagesForRole(undefined)).toEqual([]);
    expect(pagesForRole("hacker" as never)).toEqual([]);
    expect(canAccessPage(undefined, "/settings")).toBe(false);
  });

  it("canAccessPage: kasir diblokir /settings, boleh /pos", () => {
    expect(canAccessPage("kasir", "/settings")).toBe(false);
    expect(canAccessPage("kasir", "/pos")).toBe(true);
    expect(canAccessPage("manager", "/settings")).toBe(false);
    expect(canAccessPage("superadmin", "/settings")).toBe(true);
  });

  it("canSeeProfit: hanya superadmin", () => {
    expect(canSeeProfit("superadmin")).toBe(true);
    expect(canSeeProfit("manager")).toBe(false);
    expect(canSeeProfit("admin")).toBe(false);
    expect(canSeeProfit("kasir")).toBe(false);
    expect(canSeeProfit(undefined)).toBe(false);
  });

  it("canManageStock: superadmin + manager saja (paritas RPC can_manage_stock)", () => {
    expect(canManageStock("superadmin")).toBe(true);
    expect(canManageStock("manager")).toBe(true);
    expect(canManageStock("admin")).toBe(false);
    expect(canManageStock("kasir")).toBe(false);
  });

  it("canManageTransactions: superadmin + manager (kasir/admin read-only)", () => {
    expect(canManageTransactions("manager")).toBe(true);
    expect(canManageTransactions("superadmin")).toBe(true);
    expect(canManageTransactions("kasir")).toBe(false);
    expect(canManageTransactions("admin")).toBe(false);
  });

  it("isAllStoreRole & canManageStaff", () => {
    expect(isAllStoreRole("superadmin")).toBe(true);
    expect(isAllStoreRole("manager")).toBe(true);
    expect(isAllStoreRole("admin")).toBe(true);
    expect(isAllStoreRole("kasir")).toBe(false);
    expect(canManageStaff("superadmin")).toBe(true);
    expect(canManageStaff("manager")).toBe(false);
  });
});
