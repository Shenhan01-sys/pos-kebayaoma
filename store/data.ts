"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  products as seedProducts,
  categories as seedCategories,
  customers as seedCustomers,
  type Product,
  type Variant,
  type Category,
  type Customer,
} from "@/lib/dummy";

export type Role = "admin" | "manager" | "cashier";

export interface Staff {
  id: string;
  name: string;
  pin: string;
  role: Role;
  phone?: string;
  email?: string;
  commissionRate?: number;
  active: boolean;
}

export type MovementType =
  | "sale"
  | "restock"
  | "adjustment"
  | "return"
  | "transfer";

export interface Movement {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  type: MovementType;
  quantity: number; // signed (+ in / - out)
  reason?: string;
  note?: string;
  staff: string;
  createdAt: string;
}

interface DataState {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  staff: Staff[];
  movements: Movement[];

  // categories
  addCategory: (c: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // products
  addProduct: (p: Omit<Product, "id" | "variants"> & { variants: Variant[] }) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addVariant: (productId: string, v: Variant) => void;
  updateVariant: (productId: string, variantId: string, patch: Partial<Variant>) => void;
  removeVariant: (productId: string, variantId: string) => void;

  // stock
  adjustStock: (
    variantId: string,
    quantity: number,
    type: MovementType,
    staff: string,
    reason?: string,
    note?: string
  ) => void;

  // customers
  addCustomer: (c: Omit<Customer, "id">) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // staff
  addStaff: (s: Omit<Staff, "id">) => void;
  updateStaff: (id: string, patch: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;
}

let idc = 1000;
const uid = (p: string) => `${p}${++idc}`;

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      products: seedProducts,
      categories: seedCategories,
      customers: seedCustomers,
      staff: [
        { id: "st1", name: "Ani", pin: "1234", role: "admin", active: true },
        { id: "st2", name: "Budi", pin: "2345", role: "cashier", active: true },
        { id: "st3", name: "Citra", pin: "3456", role: "manager", active: true },
      ],
      movements: [],

      addCategory: (c) =>
        set((s) => ({ categories: [...s.categories, { ...c, id: uid("cat-") }] })),
      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      addProduct: (p) =>
        set((s) => ({
          products: [...s.products, { ...p, id: uid("p-") } as Product],
        })),
      updateProduct: (id, patch) =>
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      addVariant: (productId, v) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, variants: [...p.variants, v] } : p
          ),
        })),
      updateVariant: (productId, variantId, patch) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  variants: p.variants.map((v) =>
                    v.id === variantId ? { ...v, ...patch } : v
                  ),
                }
              : p
          ),
        })),
      removeVariant: (productId, variantId) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId
              ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) }
              : p
          ),
        })),

      adjustStock: (variantId, quantity, type, staff, reason, note) =>
        set((s) => {
          const prod = s.products.find((p) =>
            p.variants.some((v) => v.id === variantId)
          );
          const v = prod?.variants.find((x) => x.id === variantId);
          if (!prod || !v) return {};
          const newStock = Math.max(0, v.stock + quantity);
          return {
            products: s.products.map((p) =>
              p.id === prod.id
                ? {
                    ...p,
                    variants: p.variants.map((x) =>
                      x.id === variantId ? { ...x, stock: newStock } : x
                    ),
                  }
                : p
            ),
            movements: [
              {
                id: uid("mv-"),
                variantId,
                sku: v.sku,
                productName: prod.name,
                type,
                quantity,
                reason,
                note,
                staff,
                createdAt: new Date().toISOString(),
              },
              ...s.movements,
            ],
          };
        }),

      addCustomer: (c) =>
        set((s) => ({ customers: [...s.customers, { ...c, id: uid("c-") }] })),
      updateCustomer: (id, patch) =>
        set((s) => ({
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteCustomer: (id) =>
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

      addStaff: (st) =>
        set((s) => ({ staff: [...s.staff, { ...st, id: uid("st-") }] })),
      updateStaff: (id, patch) =>
        set((s) => ({
          staff: s.staff.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        })),
      deleteStaff: (id) =>
        set((s) => ({ staff: s.staff.filter((st) => st.id !== id) })),
    }),
    { name: "kebaya-oma-data" }
  )
);
