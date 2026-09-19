"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { humanizeError } from "@/lib/errors";
import { getPowerSyncDb, initPowerSync, isPowerSyncReady } from "@/lib/powersync/client";
import {
  enqueueTransaction,
  getPendingTransactions,
  dequeueTransaction,
  onOnline,
  type QueuedTransaction,
} from "@/lib/offline-queue";
import {
  products as dummyProducts,
  categories as dummyCategories,
  customers as dummyCustomers,
  transactions as dummyTransactions,
  shifts as dummyShifts,
  type Product,
  type Variant,
  type Category,
  type Customer,
  type Transaction,
  type TransactionItem,
  type TransactionStatus,
  type PaymentMethod,
  type Shift,
} from "@/lib/dummy";
import type { Expense } from "@/lib/expenses";
import {
  mapVariantRow,
  mapProductRow,
  mapCategoryRow,
  mapCustomerRow,
  mapStaffRow,
  mapTransactionItemRow,
  mapTransactionRow,
  mapShiftRow,
} from "@/lib/store-mappers";

const generateLocalId = () => "local-" + Math.random().toString(36).slice(2, 10);
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? "demo-store";

// Re-export safeJson for backward compat (used inline in some mappers)
export { safeJson } from "@/lib/safe-json";

// Inisialisasi PowerSync saat module load (lazy, non-blocking)
if (typeof window !== "undefined") {
  initPowerSync().catch(() => {});
}

export type Role = "superadmin" | "manager" | "admin" | "kasir";

export interface Staff {
  id: string;
  name: string;
  pin?: string;
  role: Role;
  phone?: string;
  email?: string;
  commissionRate?: number;
  active: boolean;
  storeId: string | null; // NULL = manager lintas semua toko
}

export interface StoreInfo {
  id: string;
  name: string;
  prefix: string; // MJL / KTB / TRX-
}

export type MovementType =
  | "sale"
  | "restock"
  | "adjustment"
  | "return"
  | "transfer";

export interface Movement {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  type: MovementType;
  quantity: number; // signed (+ in / - out)
  reason?: string;
  note?: string;
  staff: string;
  createdAt: string;
  vendorId?: string | null; // E2: lot vendor (movement restock/adjust)
  unitCost?: number | null; // E2: harga modal per unit lot ini
}

export interface Vendor {
  id: string;
  storeId: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  active: boolean;
}

export type TransferStatus = "pending" | "sent" | "cancelled";

export interface Transfer {
  id: string;
  fromStore: string;
  toStore: string;
  fromProduct: string;
  toProduct?: string | null;
  productName: string;
  sku: string;
  qty: number;
  status: TransferStatus;
  requestedBy: string;
  sentBy?: string | null;
  note?: string | null;
  createdAt: string;
  sentAt?: string | null;
}

export interface RentalRow {
  id: string;
  transactionId: string;
  txNumber: string;
  productId: string;
  productName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  qty: number;
  returnedQty: number;
  rentPrice: number;
  deposit?: number | null;
  startDate: string;
  dueDate: string;
}

interface DataState {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  staff: Staff[];
  stores: StoreInfo[];
  movements: Movement[];
  vendors: Vendor[];
  transactions: Transaction[];
  shifts: Shift[];
  loading: boolean;
  error: string | null;
  // Scope toko runtime: id toko operasional, atau null = semua toko (manager-all).
  // Ditentukan saat login dari staff.store_id; staff terkunci selalu terisi.
  activeStoreId: string | null;
  setActiveStore: (id: string | null) => Promise<void>;
  syncStoreScope: (storeId: string | null) => Promise<void>;

  // fetch
  fetchProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCustomers: () => Promise<void>;
  fetchStaff: () => Promise<void>;
  fetchStores: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchShifts: () => Promise<void>;

  // transactions
  saveTransaction: (tx: Omit<Transaction, "id" | "items"> & { items: TransactionItem[] }, storeOverride?: string) => Promise<Transaction | null>;
  setTransactionStatus: (id: string, status: Transaction["status"]) => Promise<void>;
  settlePreorder: (id: string, method: PaymentMethod, remaining: number) => Promise<boolean>; // E6
  flushOfflineQueue: () => Promise<void>;

  // internal side effects
  updateCustomerStats: (customerId: string, deltaPurchase: number, deltaVisit: number) => Promise<void>;
  applySaleSideEffects: (tx: Transaction) => Promise<void>;

  // shifts
  openShift: (startingCash: number, staffName: string) => Promise<void>;
  closeShift: (id: string, endingCash: number) => Promise<void>;
  currentShift: () => Shift | undefined;

  // categories
  addCategory: (c: Omit<Category, "id">) => Promise<void>;
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // products
  addProduct: (p: Omit<Product, "id" | "variants"> & { variants: Variant[] }) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addVariant: (productId: string, v: Variant) => Promise<void>;
  updateVariant: (productId: string, variantId: string, patch: Partial<Variant>) => Promise<void>;
  removeVariant: (productId: string, variantId: string) => Promise<void>;

  // stock â€” return true jika tersimpan. E2: vendorId/unitCost utk lot restock.
  adjustStock: (
    productId: string,
    quantity: number,
    type: MovementType,
    staff: string,
    reason?: string,
    note?: string,
    vendorId?: string | null,
    unitCost?: number | null
  ) => Promise<boolean>;

  // vendors (E2)
  fetchVendors: () => Promise<void>;
  addVendor: (name: string, phone?: string) => Promise<Vendor | null>;
  fetchMovements: () => Promise<void>;

  // transfers (E1) â€” return true bila tersimpan
  transfers: Transfer[];
  fetchTransfers: () => Promise<void>;
  transferProducts: (storeId: string) => Promise<{ id: string; name: string; sku: string }[]>; // E11: katalog masked
  requestTransfer: (fromStoreId: string, toStoreId: string, productId: string, qty: number, requestedBy: string, note?: string) => Promise<boolean>;
  sendTransfer: (id: string) => Promise<boolean>;
  cancelTransfer: (id: string) => Promise<boolean>;

  // rentals (E7)
  rentals: RentalRow[];
  fetchRentals: () => Promise<void>;
  createRental: (input: {
    storeId: string; productId: string; variantId: string; qty: number;
    rentPrice: number; deposit?: number | null; startDate: string; days: number;
    customerName: string; customerPhone?: string | null; cashier: string; paymentMethod: string;
  }) => Promise<string | null>;
  returnRental: (id: string, qty: number, staff: string) => Promise<boolean>;

  // expenses (E8 — petty cash, admin + superadmin)
  expenses: Expense[];
  fetchExpenses: () => Promise<void>;
  addExpense: (input: {
    storeId: string | null; date: string; description: string;
    amount: number; pic: string; photoUrl?: string;
  }) => Promise<Expense | null>;
  deleteExpense: (id: string) => Promise<boolean>;

  // customers
  addCustomer: (c: Omit<Customer, "id">) => Promise<void>;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // staff
  addStaff: (s: { name: string; pin: string; role: Role; phone?: string; active: boolean; storeId?: string | null }) => Promise<void>;
  updateStaff: (id: string, patch: { name?: string; pin?: string; role?: Role; phone?: string; active?: boolean; storeId?: string | null }) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;

  // custom items
  recordCustomItem: (item: TransactionItem) => Promise<void>;

  // realtime
  subscribeRealtime: () => (() => void);

  // fallback
  loadFallback: () => void;
}

// Foto bukti (base64 dataURL) + riwayat tak terbatas meledakkan localStorage
// (kuota ~5MB) â†’ QuotaExceededError saat saveTransaction â†’ popup stuck.
// Solusi: jangan persist photoProof, batasi jumlah tx/movement, dan
// storage anti-macet (prune + retry, terakhir hapus key agar app tetap jalan).
const stripTxForPersist = (t: Transaction) => {
  const { photoProof, ...rest } = t as Transaction & { photoProof?: string };
  return rest;
};

const quotaSafeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e: any) {
      const isQuota =
        e?.name === "QuotaExceededError" ||
        e?.code === 22 ||
        e?.code === 1014;
      if (!isQuota) throw e;
      // Coba sekali: pangkas transaksi/movement lalu tulis ulang
      try {
        const parsed = JSON.parse(value);
        const inner = parsed?.state ?? parsed;
        if (Array.isArray(inner?.transactions)) {
          inner.transactions = inner.transactions
            .slice(0, 30)
            .map((t: any) => {
              const { photoProof, ...rest } = t ?? {};
              return rest;
            });
        }
        if (Array.isArray(inner?.movements)) {
          inner.movements = inner.movements.slice(0, 50);
        }
        const pruned = parsed?.state ? { ...parsed, state: inner } : inner;
        window.localStorage.setItem(key, JSON.stringify(pruned));
      } catch {
        // Jalan terakhir: hapus key agar transaksi Supabase tetap bisa lanjut.
        // Data refetch dari server saat reload.
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* abaikan */
        }
      }
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* abaikan */
    }
  },
};

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      customers: [],
      staff: [],
      stores: [],
      movements: [],
      vendors: [],
      transfers: [],
      rentals: [],
      expenses: [],
      transactions: [],
      shifts: [],
      loading: false,
      error: null,
      // Default = store env (perilaku single-store lama) sampai login menentukan scope.
      activeStoreId: process.env.NEXT_PUBLIC_STORE_ID ?? null,

      setActiveStore: async (id) => {
        if (get().activeStoreId === id) return;
        set({ activeStoreId: id });
        // E14: fetchTransactions tidak di sini — halaman pemakai (/transactions,
        // dashboard) fetch sendiri saat activeStoreId berubah.
        await Promise.all([
          get().fetchProducts(),
          get().fetchCategories(),
          get().fetchCustomers(),
          get().fetchStaff(),
          get().fetchShifts(),
          get().fetchVendors(),
          get().fetchMovements(),
          get().fetchTransfers(),
          get().fetchRentals(),
        ]);
      },

      syncStoreScope: async (storeId) => {
        // Dipanggil auth setelah profil termuat: staff terkunci -> storeId terisi,
        // manager-all -> null (semua toko). Lalu refetch dengan scope baru.
        // E14: fetchTransactions dikeluarkan dari boot (payload 500 tx + items
        // paling berat, tidak dibutuhkan POS) — halaman pemakai fetch sendiri.
        set({ activeStoreId: storeId });
        await Promise.all([
          get().fetchStores(),
          get().fetchProducts(),
          get().fetchCategories(),
          get().fetchCustomers(),
          get().fetchStaff(),
          get().fetchShifts(),
          get().fetchVendors(),
          get().fetchMovements(),
        ]);
      },

      fetchStores: async () => {
        if (!isSupabaseReady) return;
        try {
          const { data, error } = await supabase
            .from("store_directory")
            .select("*")
            .order("name");
          if (error) throw error;
          set({
            stores: (data ?? []).map((r: any) => ({
              id: r.id,
              name: r.name,
              prefix: r.receipt_prefix && String(r.receipt_prefix).trim() !== "" ? r.receipt_prefix : "TRX-",
            })),
          });
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      loadFallback: () => {
        // Demo mode: muat data dummy jika state masih kosong
        if (get().products.length > 0) return;
        set({
          products: dummyProducts,
          categories: dummyCategories,
          customers: dummyCustomers,
          transactions: dummyTransactions,
          shifts: dummyShifts,
          staff: [
            { id: "demo-manager", name: "Demo Manager", role: "manager", active: true, storeId: null },
            { id: "demo-staff", name: "Demo Kasir", role: "kasir", active: true, storeId: null },
          ],
        });
      },

      fetchProducts: async () => {
        set({ loading: true, error: null });
        const sid = get().activeStoreId;

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              sid ? `SELECT * FROM products WHERE store_id = ? ORDER BY name`
                  : `SELECT * FROM products ORDER BY name`,
              sid ? [sid] : []
            ) as Record<string, any>[];
            const products: Product[] = [];
            for (const p of rows) {
              const vRows = await psDb.getAll(
                `SELECT * FROM variants WHERE product_id = ?`,
                [p.id]
              ) as Record<string, any>[];
              products.push(mapProductRow(p, vRows.map(mapVariantRow)));
            }
            set({ products, loading: false });
            return;
          } catch (err: any) {
            console.error("[powersync] fetchProducts error:", err);
            // fall through to Supabase
          }
        }

        if (!isSupabaseReady) {
          get().loadFallback();
          set({ loading: false });
          return;
        }
        try {
          let query: any = supabase
            .from('products')
            .select(`
              *,
              variants (*)
            `)
            .order('name');
          if (sid) query = query.eq('store_id', sid);
          const { data, error } = await query;

          if (error) throw error;

          const products = data.map((p: any) =>
            mapProductRow(p, (p.variants ?? []).map(mapVariantRow))
          );

          set({ products, loading: false });
        } catch (error: any) {
          set({ error: humanizeError(error), loading: false });
        }
      },

      fetchCategories: async () => {
        set({ loading: true, error: null });
        const sid = get().activeStoreId;

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              sid ? `SELECT * FROM categories WHERE store_id = ? ORDER BY name`
                  : `SELECT * FROM categories ORDER BY name`,
              sid ? [sid] : []
            ) as Record<string, any>[];
            set({ categories: rows.map(mapCategoryRow), loading: false });
            return;
          } catch (err: any) {
            console.error("[powersync] fetchCategories error:", err);
          }
        }

        if (!isSupabaseReady) {
          get().loadFallback();
          set({ loading: false });
          return;
        }
        try {
          let query: any = supabase
            .from('categories')
            .select('*')
            .order('name');
          if (sid) query = query.eq('store_id', sid);
          const { data, error } = await query;

          if (error) throw error;

          set({ categories: data.map(mapCategoryRow), loading: false });
        } catch (error: any) {
          set({ error: humanizeError(error), loading: false });
        }
      },

      fetchCustomers: async () => {
        set({ loading: true, error: null });
        const sid = get().activeStoreId;

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              sid ? `SELECT * FROM customers WHERE store_id = ? ORDER BY name`
                  : `SELECT * FROM customers ORDER BY name`,
              sid ? [sid] : []
            ) as Record<string, any>[];
            set({ customers: rows.map(mapCustomerRow), loading: false });
            return;
          } catch (err: any) {
            console.error("[powersync] fetchCustomers error:", err);
          }
        }

        if (!isSupabaseReady) {
          get().loadFallback();
          set({ loading: false });
          return;
        }
        try {
          let query: any = supabase
            .from('customers')
            .select('*')
            .order('name');
          if (sid) query = query.eq('store_id', sid);
          const { data, error } = await query;

          if (error) throw error;

          set({ customers: data.map(mapCustomerRow), loading: false });
        } catch (error: any) {
          set({ error: humanizeError(error), loading: false });
        }
      },

      addCategory: async (c) => {
        const sid = get().activeStoreId;
        if (!sid) {
          set({ error: "Pilih toko operasional (MJL/KTB) dulu." });
          return;
        }
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO categories (id, store_id, name, slug) VALUES (?, ?, ?, ?)`,
            [id, sid, c.name, c.slug]
          );
          set((s) => ({
            categories: [...s.categories, { id, name: c.name, slug: c.slug }],
          }));
          return;
        }
        if (!isSupabaseReady) {
          set((s) => ({
            categories: [...s.categories, { id: generateLocalId(), ...c }],
          }));
          return;
        }
        try {
          const { data, error } = await supabase
            .from('categories')
            .insert([{ name: c.name, slug: c.slug, store_id: sid }])
            .select()
            .single();

          if (error) throw error;

          set((s) => ({
            categories: [...s.categories, { id: data.id, name: data.name, slug: data.slug }]
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      updateCategory: async (id, patch) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          if (patch.name != null) {
            await psDb.execute(`UPDATE categories SET name = ? WHERE id = ?`, [patch.name, id]);
          }
          if (patch.slug != null) {
            await psDb.execute(`UPDATE categories SET slug = ? WHERE id = ?`, [patch.slug, id]);
          }
          set((s) => ({
            categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          }));
          return;
        }
        if (!isSupabaseReady) {
          set((s) => ({
            categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          }));
          return;
        }
        try {
          const { error } = await supabase
            .from('categories')
            .update(patch)
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c))
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      deleteCategory: async (id) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          await psDb.execute(`DELETE FROM categories WHERE id = ?`, [id]);
          set((s) => ({
            categories: s.categories.filter((c) => c.id !== id),
          }));
          return;
        }
        if (!isSupabaseReady) {
          set((s) => ({
            categories: s.categories.filter((c) => c.id !== id),
          }));
          return;
        }
        try {
          const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            categories: s.categories.filter((c) => c.id !== id)
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      addProduct: async (p) => {
        const sid = get().activeStoreId;
        if (!sid) {
          set({ error: "Pilih toko operasional (MJL/KTB) dulu." });
          return;
        }
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO products (id, store_id, sku, name, description, category_id, images, tags, active, stock, fabric, care, season, brand, compare_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, sid, p.sku, p.name, p.description ?? null, p.categoryId ?? null, JSON.stringify(p.images ?? []), JSON.stringify(p.tags ?? []), p.active ? 1 : 0, p.stock ?? 0, p.fabric ?? null, p.care ?? null, p.season ?? null, p.brand ?? null, p.compareAt ?? null]
          );
          for (const v of p.variants) {
            const vid = v.id || generateLocalId();
            await psDb.execute(
              `INSERT INTO variants (id, product_id, sku, name, size, color, color_code, selling_price, cost_price, barcode)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [vid, id, v.sku, v.name ?? null, v.size, v.color, v.colorCode ?? null, v.sellingPrice, v.costPrice, v.barcode ?? null]
            );
          }
          await get().fetchProducts();
          return;
        }

        if (!isSupabaseReady) {
          const id = generateLocalId();
          const variants = p.variants.map((v) => ({ ...v, id: v.id || generateLocalId() }));
          set((s) => ({
            products: [...s.products, { ...p, id, variants } as Product],
          }));
          return;
        }
        try {
          // Insert product
          // E2: stok baru = seed via adjust_stock (movement + vendor tercatat), bukan tulis absolut.
          const { seed, vendorId, unitCost, ...pRest } = p as Product & {
            seed?: number;
            vendorId?: string | null;
            unitCost?: number | null;
          };
          const seedQty = seed ?? pRest.stock ?? 0;
          const { data: product, error: productError } = await supabase
            .from('products')
            .insert([{
              sku: pRest.sku,
              name: pRest.name,
              description: pRest.description,
              category_id: pRest.categoryId,
              images: pRest.images,
              tags: pRest.tags,
              active: pRest.active,
              stock: 0,
              fabric: pRest.fabric,
              care: pRest.care,
              season: pRest.season ?? null,
              brand: pRest.brand ?? null,
              compare_at: pRest.compareAt ?? null,
              store_id: sid
            }])
            .select()
            .single();

          if (productError) throw productError;

          // Insert variants
          const variants = p.variants.map(v => ({
            sku: v.sku,
            name: v.name,
            size: v.size,
            color: v.color,
            color_code: v.colorCode,
            selling_price: v.sellingPrice,
            cost_price: v.costPrice,
            barcode: v.barcode ?? null,
            rental_price: v.rentalPrice ?? null,
            rental_days: v.rentalDays ?? 3,
            deposit_price: v.depositPrice ?? null,
            product_id: product.id
          }));

          const { error: variantsError } = await supabase
            .from('variants')
            .insert(variants);

          if (variantsError) throw variantsError;

          // Seed stok awal tercatat di ledger (restock, vendor + unit cost bila diisi).
          // FIX U7 (2026-09-18): produk baru belum ada di state FE → adjustStock tidak menemukannya
          // dan seed gagal diam-diam (stock 0, tanpa movement). Fetch dulu, baru seed via RPC.
          if (seedQty > 0) {
            await get().fetchProducts();
            const seeded = await get().adjustStock(
              product.id,
              seedQty,
              "restock",
              "katalog",
              "Stok awal (katalog)",
              undefined,
              vendorId ?? null,
              unitCost ?? null
            );
            if (!seeded) throw new Error(useData.getState().error ?? "Gagal seed stok awal (katalog).");
          } else {
            await get().fetchProducts();
          }
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      updateProduct: async (id, patch) => {
        try {
          const { variants, ...rest } = patch as Partial<Product> & { variants?: Variant[] };

          if (!isSupabaseReady) {
            set((s) => ({
              products: s.products.map((p) => {
                if (p.id !== id) return p;
                const updated = { ...p, ...rest } as Product;
                if (variants) {
                  updated.variants = variants.map((v) => ({ ...v, id: v.id || generateLocalId() }));
                }
                return updated;
              }),
            }));
            return;
          }

          const fields: Record<string, unknown> = {
            ...(rest.sku !== undefined && { sku: rest.sku }),
            ...(rest.name !== undefined && { name: rest.name }),
            ...(rest.description !== undefined && { description: rest.description }),
            ...(rest.categoryId !== undefined && { category_id: rest.categoryId }),
            ...(rest.images !== undefined && { images: rest.images }),
            ...(rest.tags !== undefined && { tags: rest.tags }),
            ...(rest.active !== undefined && { active: rest.active }),
            ...(rest.stock !== undefined && { stock: rest.stock }),
            ...(rest.fabric !== undefined && { fabric: rest.fabric }),
            ...(rest.care !== undefined && { care: rest.care }),
            ...(rest.season !== undefined && { season: rest.season ?? null }),
            ...(rest.brand !== undefined && { brand: rest.brand ?? null }),
            ...(rest.compareAt !== undefined && { compare_at: rest.compareAt ?? null }),
          };

          // E2: ubah stok dari form edit = lewat RPC atomik (movement tercatat), bukan tulis absolut.
          const cur = get().products.find((p) => p.id === id);
          const desiredStock = rest.stock;
          const stockDelta =
            desiredStock !== undefined && cur ? desiredStock - (cur.stock ?? 0) : 0;
          if ("stock" in fields) delete fields.stock;

          const { error } = await supabase
            .from('products')
            .update(fields)
            .eq('id', id);

          if (error) throw error;

          if (variants) {
            const existing = get().products.find((p) => p.id === id)?.variants ?? [];
            const existingIds = new Set(existing.map((v) => v.id));
            const incomingIds = new Set(variants.map((v) => v.id));

            for (const v of variants) {
              if (!existingIds.has(v.id)) {
                const { error: insErr } = await supabase
                  .from('variants')
                  .insert([{
                    sku: v.sku,
                    name: v.name,
                    size: v.size,
                    color: v.color,
                    color_code: v.colorCode,
                    selling_price: v.sellingPrice,
                    cost_price: v.costPrice,
                    barcode: v.barcode ?? null,
                    rental_price: v.rentalPrice ?? null,
                    rental_days: v.rentalDays ?? 3,
                    deposit_price: v.depositPrice ?? null,
                    product_id: id,
                  }]);
                if (insErr) throw insErr;
              } else {
                const { error: updErr } = await supabase
                  .from('variants')
                  .update({
                    sku: v.sku,
                    name: v.name,
                    size: v.size,
                    color: v.color,
                    color_code: v.colorCode,
                    selling_price: v.sellingPrice,
                    cost_price: v.costPrice,
                    barcode: v.barcode,
                    rental_price: v.rentalPrice ?? null,
                    rental_days: v.rentalDays ?? 3,
                    deposit_price: v.depositPrice ?? null,
                  })
                  .eq('id', v.id);
                if (updErr) throw updErr;
              }
            }

            for (const v of existing) {
              if (!incomingIds.has(v.id)) {
                const { error: delErr } = await supabase
                  .from('variants')
                  .delete()
                  .eq('id', v.id);
                if (delErr) throw delErr;
              }
            }
          }

          // E2: sinkronkan stok lewat RPC (delta) setelah field lain tersimpan
          if (stockDelta !== 0) {
            await get().adjustStock(
              id,
              stockDelta,
              stockDelta > 0 ? "restock" : "adjustment",
              "katalog",
              "Penyesuaian dari form produk"
            );
          }

          // Refresh products
          await get().fetchProducts();
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      deleteProduct: async (id) => {
        if (!isSupabaseReady) {
          set((s) => ({
            products: s.products.filter((p) => p.id !== id),
          }));
          return;
        }
        try {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            products: s.products.filter((p) => p.id !== id)
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      addVariant: async (productId, v) => {
        if (!isSupabaseReady) {
          const variant = { ...v, id: v.id || generateLocalId() };
          set((s) => ({
            products: s.products.map((p) =>
              p.id === productId ? { ...p, variants: [...p.variants, variant] } : p
            ),
          }));
          return;
        }
        try {
          const { error } = await supabase
            .from('variants')
            .insert([{ ...v, product_id: productId }]);

          if (error) throw error;

          // Refresh products
          await get().fetchProducts();
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      updateVariant: async (productId, variantId, patch) => {
        if (!isSupabaseReady) {
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
          }));
          return;
        }
        try {
          const { error } = await supabase
            .from('variants')
            .update(patch)
            .eq('id', variantId);

          if (error) throw error;

          set((s) => ({
            products: s.products.map((p) =>
              p.id === productId
                ? {
                    ...p,
                    variants: p.variants.map((v) =>
                      v.id === variantId ? { ...v, ...patch } : v
                    )
                  }
                : p
            )
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      removeVariant: async (productId, variantId) => {
        if (!isSupabaseReady) {
          set((s) => ({
            products: s.products.map((p) =>
              p.id === productId
                ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) }
                : p
            ),
          }));
          return;
        }
        try {
          const { error } = await supabase
            .from('variants')
            .delete()
            .eq('id', variantId);

          if (error) throw error;

          set((s) => ({
            products: s.products.map((p) =>
              p.id === productId
                ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) }
                : p
            )
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      // ---- internal sale side effects ----
      updateCustomerStats: async (customerId: string, deltaPurchase: number, deltaVisit: number) => {
        const customer = get().customers.find((c) => c.id === customerId);
        if (!customer) return;
        const totalPurchases = Math.max(0, (customer.totalPurchases ?? 0) + deltaPurchase);
        const visitCount = Math.max(0, (customer.visitCount ?? 0) + deltaVisit);

        const psDb = getPowerSyncDb();
        if (psDb) {
          await psDb.execute(
            `UPDATE customers SET total_purchases = ?, visit_count = ? WHERE id = ?`,
            [totalPurchases, visitCount, customerId]
          );
          set((s) => ({
            customers: s.customers.map((c) =>
              c.id === customerId ? { ...c, totalPurchases, visitCount } : c
            ),
          }));
          return;
        }

        if (!isSupabaseReady) {
          set((s) => ({
            customers: s.customers.map((c) =>
              c.id === customerId ? { ...c, totalPurchases, visitCount } : c
            ),
          }));
          return;
        }
        try {
          await supabase
            .from('customers')
            .update({ total_purchases: totalPurchases, visit_count: visitCount })
            .eq('id', customerId);
          set((s) => ({
            customers: s.customers.map((c) =>
              c.id === customerId ? { ...c, totalPurchases, visitCount } : c
            ),
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      applySaleSideEffects: async (tx: Transaction) => {
        // Kurangi stok per produk (gabungkan series dengan productId sama)
        const byProduct = new Map<string, number>();
        for (const item of tx.items) {
          byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
        }
        for (const [productId, qty] of byProduct) {
          await get().adjustStock(
            productId,
            -qty,
            "sale",
            tx.cashier,
            "Penjualan",
            tx.number
          );
        }
        // Update statistik pelanggan
        if (tx.customerId) {
          await get().updateCustomerStats(tx.customerId, tx.total, 1);
        }
      },

      adjustStock: async (productId, quantity, type, staff, reason, note, vendorId, unitCost) => {
        const product = get().products.find((p) => p.id === productId);
        if (!product) return false;
        // scope "Semua" (null) â†’ fallback ke toko milik produk (view Gabungan bisa adjust per toko)
        const sid = get().activeStoreId ?? product.storeId;
        if (!sid) {
          set({ error: "Pilih toko operasional (MJL/KTB) dulu." });
          return false;
        }

        // E2 FIX: jalur online memakai RPC atomik server (adjust_stock) â€”
        // stok dihitung server (baris di-lock), movement = delta NYATA, error tak lagi ditelan.
        if (isSupabaseReady) {
          try {
            const { data: newStockData, error: rpcError } = await supabase.rpc("adjust_stock", {
              p_product: productId,
              p_store: sid,
              p_delta: quantity,
              p_type: type,
              p_staff: staff,
              p_reason: reason ?? null,
              p_note: note ?? null,
              p_vendor: vendorId ?? null,
              p_unit_cost: unitCost ?? null,
            });
            if (rpcError) throw rpcError;
            const serverStock = Number(newStockData);
            set((s) => ({
              products: s.products.map((p) =>
                p.id === productId ? { ...p, stock: serverStock } : p
              ),
            }));
            await get().fetchMovements();
            return true;
          } catch (error: any) {
            set({ error: humanizeError(error, { stock: product.stock, action: "menyesuaikan stok" }) });
            return false;
          }
        }

        // Offline/demo: hanya state lokal (PowerSync nonaktif; label tetap dibersihkan oleh ledger server).
        const psDb = getPowerSyncDb();
        const newStock = Math.max(0, (product.stock ?? 0) + quantity);
        if (psDb) {
          await psDb.execute(
            `UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?`,
            [quantity, productId]
          );
          await psDb.execute(
            `INSERT INTO stock_movements (id, store_id, variant_id, sku, product_name, type, quantity, reason, note, staff, vendor_id, unit_cost, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [generateLocalId(), sid, productId, product.sku, product.name, type, quantity, reason ?? null, note ?? null, staff, vendorId ?? null, unitCost ?? null]
          );
        }
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, stock: newStock } : p
          ),
          movements: [
            {
              id: `mv-${Date.now()}`,
              productId,
              sku: product.sku,
              productName: product.name,
              type,
              quantity,
              reason,
              note,
              staff,
              vendorId: vendorId ?? null,
              unitCost: unitCost ?? null,
              createdAt: new Date().toISOString(),
            },
            ...s.movements,
          ],
        }));
        return true;
      },

      fetchVendors: async () => {
        if (!isSupabaseReady) return;
        const sid = get().activeStoreId;
        try {
          let query: any = supabase.from("vendors").select("*").order("name");
          if (sid) query = query.eq("store_id", sid);
          const { data, error } = await query;
          if (error) throw error;
          set({
            vendors: (data ?? []).map((v: any) => ({
              id: v.id,
              storeId: v.store_id,
              name: v.name,
              phone: v.phone ?? null,
              note: v.note ?? null,
              active: Boolean(v.active),
            })),
          });
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      addVendor: async (name, phone) => {
        const sid = get().activeStoreId;
        if (!sid) {
          set({ error: "Pilih toko operasional (MJL/KTB) dulu." });
          return null;
        }
        const trimmed = name.trim();
        if (!trimmed) return null;
        if (!isSupabaseReady) {
          const local: Vendor = { id: generateLocalId(), storeId: sid, name: trimmed, phone: phone ?? null, active: true };
          set((s) => ({ vendors: [...s.vendors, local] }));
          return local;
        }
        try {
          const { data, error } = await supabase
            .from("vendors")
            .insert([{ store_id: sid, name: trimmed, phone: phone ?? null }])
            .select()
            .single();
          if (error) {
            // 23505 = vendor sudah ada (beda kapital) â†’ pakai yang ada (auto-insert idempoten)
            if (error.code === "23505") {
              const { data: existing } = await supabase
                .from("vendors")
                .select("*")
                .eq("store_id", sid)
                .ilike("name", trimmed)
                .limit(1)
                .maybeSingle();
              if (existing) {
                const v: Vendor = { id: existing.id, storeId: existing.store_id, name: existing.name, phone: existing.phone ?? null, note: existing.note ?? null, active: Boolean(existing.active) };
                set((s) => ({ vendors: s.vendors.some((x) => x.id === v.id) ? s.vendors : [...s.vendors, v] }));
                return v;
              }
            }
            throw error;
          }
          const v: Vendor = { id: data.id, storeId: data.store_id, name: data.name, phone: data.phone ?? null, note: data.note ?? null, active: Boolean(data.active) };
          set((s) => ({ vendors: [...s.vendors, v] }));
          return v;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return null;
        }
      },

      fetchMovements: async () => {
        if (!isSupabaseReady) return;
        const sid = get().activeStoreId;
        try {
          let query: any = supabase
            .from("stock_movements")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200);
          if (sid) query = query.eq("store_id", sid);
          const { data, error } = await query;
          if (error) throw error;
          set({
            movements: (data ?? []).map((m: any) => ({
              id: m.id,
              productId: m.variant_id,
              sku: m.sku,
              productName: m.product_name,
              type: m.type,
              quantity: Number(m.quantity),
              reason: m.reason ?? undefined,
              note: m.note ?? undefined,
              staff: m.staff,
              vendorId: m.vendor_id ?? null,
              unitCost: m.unit_cost != null ? Number(m.unit_cost) : null,
              createdAt: m.created_at,
            })),
          });
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      fetchTransfers: async () => {
        if (!isSupabaseReady) return;
        try {
          // E11: RPC security-definer tersegelong — staff pengaju lintas toko ikut
          // melihat nama produk (join products terblokir RLS biasa); tanpa angka stok.
          const { data, error } = await supabase.rpc("list_transfers");
          if (error) throw error;
          set({
            transfers: (data ?? []).map((t: any) => ({
              id: t.id,
              fromStore: t.from_store,
              toStore: t.to_store,
              fromProduct: t.from_product,
              toProduct: t.to_product ?? null,
              productName: t.product_name ?? "—",
              sku: t.product_sku ?? "—",
              qty: Number(t.qty),
              status: t.status,
              requestedBy: t.requested_by,
              sentBy: t.sent_by ?? null,
              note: t.note ?? null,
              createdAt: t.created_at,
              sentAt: t.sent_at ?? null,
            })),
          });
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      transferProducts: async (storeId: string): Promise<{ id: string; name: string; sku: string }[]> => {
        if (!isSupabaseReady) return [];
        try {
          const { data, error } = await supabase.rpc("list_transfer_products", { p_store: storeId });
          if (error) throw error;
          return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, sku: r.sku }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return [];
        }
      },

      requestTransfer: async (fromStoreId, toStoreId, productId, qty, requestedBy, note) => {
        if (!isSupabaseReady) {
          set({ error: "Transfer butuh koneksi ke server." });
          return false;
        }
        try {
          const { error } = await supabase.from("stock_transfers").insert([{
            from_store: fromStoreId,
            to_store: toStoreId,
            from_product: productId,
            qty,
            requested_by: requestedBy,
            note: note || null,
          }]);
          if (error) throw error;
          await get().fetchTransfers();
          return true;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return false;
        }
      },

      sendTransfer: async (id) => {
        if (!isSupabaseReady) return false;
        try {
          const { error } = await supabase.rpc("send_transfer", { p_transfer: id });
          if (error) throw error;
          await Promise.all([get().fetchTransfers(), get().fetchProducts(), get().fetchMovements()]);
          return true;
        } catch (error: any) {
          const tr = get().transfers.find((t) => t.id === id);
          const stockNow = tr ? get().products.find((p) => p.id === tr.fromProduct)?.stock : undefined;
          set({ error: humanizeError(error, { stock: stockNow, action: "mengirim transfer" }) });
          return false;
        }
      },

      cancelTransfer: async (id) => {
        if (!isSupabaseReady) return false;
        try {
          const { error } = await supabase.rpc("cancel_transfer", { p_transfer: id });
          if (error) throw error;
          await get().fetchTransfers();
          return true;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return false;
        }
      },

      fetchRentals: async () => {
        if (!isSupabaseReady) return;
        const sid = get().activeStoreId;
        try {
          const { data, error } = await supabase
            .from("rentals")
            .select("*, customers(name, phone), transactions(number, store_id), products(name)")
            .order("due_date", { ascending: true })
            .limit(200);
          if (error) throw error;
          set({
            rentals: (data ?? [])
              .filter((r: any) => !sid || r.transactions?.store_id === sid)
              .map((r: any) => ({
              id: r.id,
              transactionId: r.transaction_id,
              txNumber: r.transactions?.number ?? "â€”",
              productId: r.product_id,
              productName: r.products?.name ?? "â€”",
              customerName: r.customers?.name ?? null,
              customerPhone: r.customers?.phone ?? null,
              qty: Number(r.qty),
              returnedQty: Number(r.returned_qty ?? 0),
              rentPrice: Number(r.rent_price),
              deposit: r.deposit != null ? Number(r.deposit) : null,
              startDate: r.start_date,
              dueDate: r.due_date,
            })),
          });
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      createRental: async (input) => {
        if (!isSupabaseReady) { set({ error: "Sewa butuh koneksi server." }); return null; }
        try {
          const { data, error } = await supabase.rpc("create_rental", {
            p_store: input.storeId,
            p_product: input.productId,
            p_variant: input.variantId,
            p_qty: input.qty,
            p_rent_price: input.rentPrice,
            p_deposit: input.deposit ?? null,
            p_start_date: input.startDate,
            p_days: input.days,
            p_customer_name: input.customerName,
            p_customer_phone: input.customerPhone ?? null,
            p_cashier: input.cashier,
            p_payment_method: input.paymentMethod,
          });
          if (error) throw error;
          await Promise.all([get().fetchProducts(), get().fetchRentals(), get().fetchTransactions(), get().fetchCustomers()]);
          return (data as string) ?? null;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return null;
        }
      },

      returnRental: async (id, qty, staff) => {
        if (!isSupabaseReady) return false;
        try {
          const { error } = await supabase.rpc("return_rental", { p_rental: id, p_qty: qty, p_staff: staff });
          if (error) throw error;
          await Promise.all([get().fetchProducts(), get().fetchRentals(), get().fetchMovements()]);
          return true;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return false;
        }
      },

      // E8: petty cash — admin + superadmin (RLS DB menegakkan; FE hanya UX)
      fetchExpenses: async () => {
        if (!isSupabaseReady) return;
        try {
          const { data, error } = await supabase
            .from("expenses")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(500);
          if (error) throw error;
          const expenses: Expense[] = (data ?? []).map((r: any) => ({
            id: r.id,
            storeId: r.store_id ?? null,
            date: r.date,
            description: r.description ?? "",
            amount: Number(r.amount),
            pic: r.pic ?? "",
            photoUrl: r.photo_url ?? undefined,
            createdBy: r.created_by ?? null,
            createdAt: r.created_at,
          }));
          set({ expenses });
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      addExpense: async (input) => {
        if (!isSupabaseReady) {
          set({ error: "Pengeluaran butuh koneksi ke server." });
          return null;
        }
        try {
          const { data: auth } = await supabase.auth.getUser();
          const { data, error } = await supabase
            .from("expenses")
            .insert([{
              store_id: input.storeId,
              date: input.date,
              description: input.description,
              amount: input.amount,
              pic: input.pic,
              photo_url: input.photoUrl ?? null,
              created_by: auth?.user?.id ?? null,
            }])
            .select()
            .single();
          if (error) throw error;
          const row: Expense = {
            id: data.id,
            storeId: data.store_id ?? null,
            date: data.date,
            description: data.description ?? "",
            amount: Number(data.amount),
            pic: data.pic ?? "",
            photoUrl: data.photo_url ?? undefined,
            createdBy: data.created_by ?? null,
            createdAt: data.created_at,
          };
          set({ expenses: [row, ...get().expenses] });
          return row;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return null;
        }
      },

      deleteExpense: async (id) => {
        if (!isSupabaseReady) return false;
        try {
          const { error } = await supabase.from("expenses").delete().eq("id", id);
          if (error) throw error;
          set({ expenses: get().expenses.filter((e) => e.id !== id) });
          return true;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return false;
        }
      },

      addCustomer: async (c) => {
        const sid = get().activeStoreId;
        if (!sid) {
          const msg = "Pilih toko operasional (MJL/KTB) dulu — pelanggan tercatat ke toko aktif.";
          set({ error: msg });
          throw new Error(msg);
        }
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO customers (id, store_id, name, phone, email, address, birthday, notes, tags, total_purchases, visit_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, sid, c.name, c.phone ?? null, c.email ?? null, c.address ?? null, c.birthday ?? null, c.notes ?? null, JSON.stringify(c.tags ?? []), 0, 0]
          );
          set((s) => ({
            customers: [...s.customers, { id, ...c, totalPurchases: 0, visitCount: 0 }],
          }));
          return;
        }
        if (!isSupabaseReady) {
          set((s) => ({
            customers: [
              ...s.customers,
              {
                id: generateLocalId(),
                ...c,
                totalPurchases: 0,
                visitCount: 0,
              },
            ],
          }));
          return;
        }
        try {
          const { data, error } = await supabase
            .from('customers')
            .insert([{
              name: c.name,
              phone: c.phone,
              email: c.email ?? null,
              address: c.address ?? null,
              // FIX #30: form mengirim string kosong → Postgres menolak date "" (invalid input syntax)
              birthday: c.birthday ? c.birthday : null,
              notes: c.notes ?? null,
              tags: c.tags ?? [],
              store_id: sid
            }])
            .select()
            .single();

          if (error) throw error;

          set((s) => ({
            customers: [...s.customers, {
              id: data.id,
              name: data.name,
              phone: data.phone,
              totalPurchases: data.total_purchases,
              visitCount: data.visit_count,
              email: data.email ?? undefined,
              address: data.address ?? undefined,
              birthday: data.birthday ?? undefined,
              notes: data.notes ?? undefined,
              tags: data.tags ?? []
            }]
          }));
        } catch (error: any) {
          // FIX bug create-customer (2026-09-18): jangan telan error — caller (modal)
          // harus tahu gagal, bukan menutup modal seolah sukses.
          const msg = humanizeError(error);
          set({ error: msg });
          throw new Error(msg);
        }
      },

      updateCustomer: async (id, patch) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          if (patch.name != null) await psDb.execute(`UPDATE customers SET name = ? WHERE id = ?`, [patch.name, id]);
          if (patch.phone != null) await psDb.execute(`UPDATE customers SET phone = ? WHERE id = ?`, [patch.phone, id]);
          if (patch.email !== undefined) await psDb.execute(`UPDATE customers SET email = ? WHERE id = ?`, [patch.email ?? null, id]);
          if (patch.address !== undefined) await psDb.execute(`UPDATE customers SET address = ? WHERE id = ?`, [patch.address ?? null, id]);
          if (patch.birthday !== undefined) await psDb.execute(`UPDATE customers SET birthday = ? WHERE id = ?`, [patch.birthday ?? null, id]);
          if (patch.notes !== undefined) await psDb.execute(`UPDATE customers SET notes = ? WHERE id = ?`, [patch.notes ?? null, id]);
          if (patch.tags !== undefined) await psDb.execute(`UPDATE customers SET tags = ? WHERE id = ?`, [JSON.stringify(patch.tags ?? []), id]);
          set((s) => ({
            customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          }));
          return;
        }
        if (!isSupabaseReady) {
          set((s) => ({
            customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          }));
          return;
        }
        try {
          const fields: Record<string, unknown> = {
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.phone !== undefined && { phone: patch.phone }),
            ...(patch.email !== undefined && { email: patch.email ?? null }),
            ...(patch.address !== undefined && { address: patch.address ?? null }),
            ...(patch.birthday !== undefined && { birthday: patch.birthday ? patch.birthday : null }),
            ...(patch.notes !== undefined && { notes: patch.notes ?? null }),
            ...(patch.tags !== undefined && { tags: patch.tags ?? [] }),
          };

          const { error } = await supabase
            .from('customers')
            .update(fields)
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            customers: s.customers.map((c) => (c.id === id ? { ...c, ...fields } : c))
          }));
        } catch (error: any) {
          // FIX #30: sama dgn addCustomer — jangan telan error update customer.
          const msg = humanizeError(error);
          set({ error: msg });
          throw new Error(msg);
        }
      },

      deleteCustomer: async (id) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          await psDb.execute(`DELETE FROM customers WHERE id = ?`, [id]);
          set((s) => ({
            customers: s.customers.filter((c) => c.id !== id),
          }));
          return;
        }
        if (!isSupabaseReady) {
          set((s) => ({
            customers: s.customers.filter((c) => c.id !== id),
          }));
          return;
        }
        try {
          const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            customers: s.customers.filter((c) => c.id !== id)
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      fetchStaff: async () => {
        set({ loading: true, error: null });
        const sid = get().activeStoreId;

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              sid ? `SELECT * FROM staff WHERE store_id = ? ORDER BY name`
                  : `SELECT * FROM staff ORDER BY name`,
              sid ? [sid] : []
            ) as Record<string, any>[];
            set({ staff: rows.map(mapStaffRow), loading: false });
            return;
          } catch (err: any) {
            console.error("[powersync] fetchStaff error:", err);
          }
        }

        if (!isSupabaseReady) {
          get().loadFallback();
          set({ loading: false });
          return;
        }
        try {
          let query: any = supabase
            .from('staff')
            .select('*')
            .order('name');
          // Manager-all (sid null) sengaja tanpa filter: halaman Staff kelola semua toko.
          if (sid) query = query.eq('store_id', sid);
          const { data, error } = await query;

          if (error) throw error;

          set({ staff: data.map(mapStaffRow), loading: false });
        } catch (error: any) {
          set({ error: humanizeError(error), loading: false });
        }
      },

      fetchTransactions: async () => {
        set({ loading: true, error: null });
        const sid = get().activeStoreId;

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              sid ? `SELECT * FROM transactions WHERE store_id = ? ORDER BY created_at DESC LIMIT 200`
                  : `SELECT * FROM transactions ORDER BY created_at DESC LIMIT 200`,
              sid ? [sid] : []
            ) as Record<string, any>[];
            const transactions: Transaction[] = [];
            for (const t of rows) {
              const iRows = await psDb.getAll(
                `SELECT * FROM transaction_items WHERE transaction_id = ?`,
                [t.id]
              ) as Record<string, any>[];
              transactions.push(mapTransactionRow(t, iRows.map(mapTransactionItemRow)));
            }
            set({ transactions, loading: false });
            return;
          } catch (err: any) {
            console.error("[powersync] fetchTransactions error:", err);
          }
        }

        if (!isSupabaseReady) {
          get().loadFallback();
          set({ loading: false });
          return;
        }
        try {
          let query: any = supabase
            .from('transactions')
            .select(`
              *,
              transaction_items (*)
            `)
            .order('created_at', { ascending: false })
            .limit(200);
          if (sid) query = query.eq('store_id', sid);
          const { data, error } = await query;

          if (error) throw error;

          const transactions = data.map((t: any) =>
            mapTransactionRow(t, (t.transaction_items ?? []).map(mapTransactionItemRow))
          );

          set({ transactions, loading: false });
        } catch (error: any) {
          set({ error: humanizeError(error), loading: false });
        }
      },

      fetchShifts: async () => {
        set({ loading: true, error: null });
        const sid = get().activeStoreId;

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              sid ? `SELECT * FROM shifts WHERE store_id = ? ORDER BY opened_at DESC LIMIT 100`
                  : `SELECT * FROM shifts ORDER BY opened_at DESC LIMIT 100`,
              sid ? [sid] : []
            ) as Record<string, any>[];
            set({ shifts: rows.map(mapShiftRow), loading: false });
            return;
          } catch (err: any) {
            console.error("[powersync] fetchShifts error:", err);
          }
        }

        if (!isSupabaseReady) {
          get().loadFallback();
          set({ loading: false });
          return;
        }
        try {
          let query: any = supabase
            .from('shifts')
            .select('*')
            .order('opened_at', { ascending: false })
            .limit(100);
          if (sid) query = query.eq('store_id', sid);
          const { data, error } = await query;

          if (error) throw error;

          set({ shifts: data.map(mapShiftRow), loading: false });
        } catch (error: any) {
          set({ error: humanizeError(error), loading: false });
        }
      },

      openShift: async (startingCash, staffName) => {
        const sid = get().activeStoreId;
        if (!sid) {
          set({ error: "Pilih toko operasional (MJL/KTB) dulu." });
          return;
        }
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO shifts (id, store_id, staff_name, opened_at, starting_cash, status, total_transactions, total_sales, total_qris, total_cash)
             VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)`,
            [id, sid, staffName, startingCash, "open", 0, 0, 0, 0]
          );
          await get().fetchShifts();
          return;
        }
        if (!isSupabaseReady) {
          const shift: Shift = {
            id: generateLocalId(),
            staff_name: staffName,
            opened_at: new Date().toISOString(),
            startingCash,
            totalTransactions: 0,
            totalSales: 0,
            totalQris: 0,
            totalCash: 0,
            status: "open",
          };
          set((s) => ({ shifts: [shift, ...s.shifts] }));
          return;
        }
        try {
          const { data, error } = await supabase
            .from('shifts')
            .insert([{
              store_id: sid,
              staff_name: staffName,
              opened_at: new Date().toISOString(),
              starting_cash: startingCash,
              status: 'open',
              total_transactions: 0,
              total_sales: 0,
              total_qris: 0,
              total_cash: 0,
            }])
            .select()
            .single();

          if (error) throw error;

          set((s) => ({
            shifts: [
              {
                id: data.id,
                staff_name: data.staff_name,
                opened_at: data.opened_at,
                closed_at: data.closed_at ?? undefined,
                startingCash: data.starting_cash,
                endingCash: data.ending_cash ?? undefined,
                totalTransactions: data.total_transactions,
                totalSales: data.total_sales,
                totalQris: data.total_qris,
                totalCash: data.total_cash,
                status: data.status,
              },
              ...s.shifts,
            ],
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      closeShift: async (id, endingCash) => {
        const shift = get().shifts.find((s) => s.id === id);
        if (!shift) return;

        const openedAt = new Date(shift.opened_at).toISOString();
        const txs = get().transactions.filter(
          (t) => t.status === "paid" && new Date(t.createdAt) >= new Date(openedAt)
        );
        const totalTransactions = txs.length;
        const totalSales = txs.reduce((sum, t) => sum + t.total, 0);
        const totalQris = txs
          .filter((t) => t.paymentMethod === "qris")
          .reduce((sum, t) => sum + t.total, 0);
        const totalCash = txs
          .filter((t) => t.paymentMethod === "cash")
          .reduce((sum, t) => sum + t.total, 0);

        const psDb = getPowerSyncDb();
        if (psDb) {
          await psDb.execute(
            `UPDATE shifts SET closed_at = datetime('now'), ending_cash = ?, status = ?, total_transactions = ?, total_sales = ?, total_qris = ?, total_cash = ? WHERE id = ?`,
            [endingCash, "closed", totalTransactions, totalSales, totalQris, totalCash, id]
          );
          set((s) => ({
            shifts: s.shifts.map((sh) =>
              sh.id === id
                ? {
                    ...sh,
                    closed_at: new Date().toISOString(),
                    endingCash,
                    status: "closed" as const,
                    totalTransactions,
                    totalSales,
                    totalQris,
                    totalCash,
                  }
                : sh
            ),
          }));
          return;
        }

        if (!isSupabaseReady) {
          set((s) => ({
            shifts: s.shifts.map((sh) =>
              sh.id === id
                ? {
                    ...sh,
                    closed_at: new Date().toISOString(),
                    endingCash,
                    status: "closed" as const,
                    totalTransactions,
                    totalSales,
                    totalQris,
                    totalCash,
                  }
                : sh
            ),
          }));
          return;
        }

        try {
          const { error } = await supabase
            .from('shifts')
            .update({
              closed_at: new Date().toISOString(),
              ending_cash: endingCash,
              status: 'closed',
              total_transactions: totalTransactions,
              total_sales: totalSales,
              total_qris: totalQris,
              total_cash: totalCash,
            })
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            shifts: s.shifts.map((sh) =>
              sh.id === id
                ? {
                    ...sh,
                    closed_at: new Date().toISOString(),
                    endingCash,
                    status: "closed" as const,
                    totalTransactions,
                    totalSales,
                    totalQris,
                    totalCash,
                  }
                : sh
            ),
          }));
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      currentShift: () => {
        return get().shifts.find((s) => s.status === "open");
      },

      saveTransaction: async (tx, storeOverride) => {
        try {
          // Toko konkret wajib: manager-all (scope Semua) harus pilih MJL/KTB dulu.
          // storeOverride dipakai flush offline-queue agar ikut toko asal antrean.
          const sid = storeOverride ?? get().activeStoreId;
          if (!sid) {
            set({ error: "Pilih toko operasional (MJL/KTB) dulu." });
            return null;
          }
          const customer = tx.customerName
            ? get().customers.find((c) => c.name === tx.customerName)
            : undefined;

          // OFFLINE PATH â€” simpan ke local state + IndexedDB queue, flush saat online
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            const localId = generateLocalId();
            const saved: Transaction = {
              ...tx,
              id: localId,
              storeId: sid,
              customerId: customer?.id,
              createdAt: new Date().toISOString(),
            };
            set((s) => ({ transactions: [saved, ...s.transactions] }));
            if (saved.status === "paid") {
              await get().applySaleSideEffects(saved);
            }
            await enqueueTransaction({
              localId,
              tx: { ...tx, items: tx.items },
              enqueuedAt: new Date().toISOString(),
              storeId: sid,
            } as QueuedTransaction);
            console.info("[offline-queue] Transaction queued:", localId);
            return saved;
          }

          const psDb = getPowerSyncDb();
          if (psDb) {
            const id = generateLocalId();
             await psDb.execute(
               `INSERT INTO transactions (id, store_id, number, cashier, customer_id, customer_name, status, payment_method, payment_status, subtotal, tax, discount, total, amount_paid, change, qris_ref, photo_proof, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
               [id, sid, tx.number, tx.cashier, customer?.id ?? null, tx.customerName ?? null, tx.status, tx.paymentMethod, tx.paymentStatus, tx.subtotal, tx.tax, tx.discount, tx.total, tx.amountPaid, tx.change, tx.qrisRef ?? null, (tx as any).photoProof ?? null]
             );
             for (const i of tx.items) {
                await psDb.execute(
                  `INSERT INTO transaction_items (id, transaction_id, product_id, variant_id, name, sku, size, color, quantity, unit_price, cost_price, discount, total, vendor_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [generateLocalId(), id, i.productId, i.variantId, i.name, i.sku, i.size, i.color, i.quantity, i.unitPrice, i.costPrice > 0 ? i.costPrice : null, i.discount, i.total, i.vendorId ?? null]
                );
              }
            const saved: Transaction = { ...tx, id, storeId: sid, customerId: customer?.id, createdAt: new Date().toISOString() };
            set((s) => ({ transactions: [saved, ...s.transactions] }));
            // PowerSync lokal tanpa trigger DB â€” efek stok dikerjakan di client
            if (saved.status === "paid") {
              await get().applySaleSideEffects(saved);
            }
            return saved;
          }

          if (!isSupabaseReady) {
            const saved: Transaction = {
              ...tx,
              id: generateLocalId(),
              storeId: sid,
              customerId: customer?.id,
              createdAt: new Date().toISOString(),
            };
            set((s) => ({
              transactions: [saved, ...s.transactions],
            }));
            if (saved.status === "paid") {
              await get().applySaleSideEffects(saved);
            }
            return saved;
          }

          // Nomor nota atomik dari server â€” aman untuk multi-kasir.
          // Preorder memakai prefix khusus PO- (E6).
          const isPo = (tx as Transaction).kind === "preorder";
          const { data: serverNumber, error: numberError } = await supabase.rpc(
            isPo ? 'next_po_number' : 'next_tx_number',
            { p_store_id: sid }
          );
          if (numberError || !serverNumber) {
            throw numberError ?? new Error("Gagal membuat nomor nota");
          }

          // Simpan header sebagai pending dulu: trigger AFTER INSERT tidak boleh
          // jalan sebelum items ada. Status final diterapkan via update di bawah,
          // sehingga trigger pending->paid/partial melihat items lengkap.
          const { data: header, error: headerError } = await supabase
            .from('transactions')
            .insert([{
              store_id: sid,
              number: serverNumber as string,
              cashier: tx.cashier,
              customer_id: customer?.id ?? null,
              customer_name: tx.customerName ?? null,
              status: 'pending',
              payment_method: tx.paymentMethod,
              payment_status: 'pending',
              subtotal: tx.subtotal,
              tax: tx.tax,
              discount: tx.discount,
              total: tx.total,
              amount_paid: tx.amountPaid,
              change: tx.change,
              qris_ref: tx.qrisRef ?? null,
              photo_proof: (tx as any).photoProof ?? null,
              kind: isPo ? 'preorder' : 'sale',
              due_date: (tx as Transaction).dueDate ?? null,
              dp_amount: (tx as Transaction).dpAmount ?? null,
              dp_method: (tx as Transaction).dpMethod ?? null,
            }])
            .select()
            .single();

          if (headerError) throw headerError;

          const { error: itemsError } = await supabase
            .from('transaction_items')
            .insert(tx.items.map((i) => ({
              transaction_id: header.id,
              product_id: i.productId,
              variant_id: i.variantId,
              name: i.name,
              sku: i.sku,
              size: i.size,
              color: i.color,
               quantity: i.quantity,
               unit_price: i.unitPrice,
               cost_price: i.costPrice > 0 ? i.costPrice : null,
               discount: i.discount,
               total: i.total,
               vendor_id: i.vendorId ?? null,
             })));

          if (itemsError) throw itemsError;

          // Terapkan status final â€” trigger pending->paid jalan di sini (items sudah ada)
          let finalStatus: Transaction["status"] = "pending";
          let finalPaymentStatus: Transaction["paymentStatus"] = "pending";
          if (tx.status !== "pending" || tx.paymentStatus !== "pending") {
            const { data: updated, error: statusError } = await supabase
              .from('transactions')
              .update({ status: tx.status, payment_status: tx.paymentStatus })
              .eq('id', header.id)
              .select()
              .single();
            if (statusError) throw statusError;
            finalStatus = updated.status;
            finalPaymentStatus = updated.payment_status;
          }

          const saved: Transaction = {
            id: header.id,
            number: header.number,
            storeId: header.store_id ?? sid,
            cashier: header.cashier,
            customerId: header.customer_id ?? undefined,
            customerName: header.customer_name ?? undefined,
            status: finalStatus,
            paymentMethod: header.payment_method,
            paymentStatus: finalPaymentStatus,
            subtotal: header.subtotal,
            tax: header.tax,
            discount: header.discount,
            total: header.total,
            amountPaid: header.amount_paid,
            change: header.change,
            qrisRef: header.qris_ref ?? undefined,
            photoProof: (header as any).photo_proof ?? undefined,
            createdAt: header.created_at,
            items: tx.items,
          };

          set((s) => ({
            transactions: [saved, ...s.transactions.filter((x) => x.id !== saved.id)],
          }));

          // Efek stok online dikerjakan trigger DB pending->paid (bukan client)

          return saved;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return null;
        }
      },

      setTransactionStatus: async (id, status) => {
        const prev = get().transactions.find((t) => t.id === id);
        const exists = !!prev;

        const psDb = getPowerSyncDb();
        if (psDb) {
          if (exists) {
            await psDb.execute(`UPDATE transactions SET status = ? WHERE id = ?`, [status, id]);
            set((s) => ({
              transactions: s.transactions.map((t) =>
                t.id === id ? { ...t, status } : t
              ),
            }));
            // Saat online, Supabase trigger menangani stok.
            // Saat offline, stok di-handle lokal via adjustStock.
            if (prev.status === "pending" && status === "paid") {
              await get().applySaleSideEffects({ ...prev, status: "paid" });
            }
            if (
              prev.status === "paid" &&
              (status === "cancelled" || status === "refunded")
            ) {
              const retByProduct = new Map<string, number>();
              for (const item of prev.items) {
                retByProduct.set(item.productId, (retByProduct.get(item.productId) ?? 0) + item.quantity);
              }
              for (const [pid, qty] of retByProduct) {
                await get().adjustStock(
                  pid,
                  qty,
                  "return",
                  prev.cashier,
                  status === "refunded" ? "Refund" : "Pembatalan",
                  prev.number
                );
              }
              if (prev.customerId) {
                await get().updateCustomerStats(prev.customerId, -prev.total, -1);
              }
            }
          }
          return;
        }

        if (!isSupabaseReady) {
          if (exists) {
            set((s) => ({
              transactions: s.transactions.map((t) =>
                t.id === id ? { ...t, status } : t
              ),
            }));
            if (prev.status === "pending" && status === "paid") {
              await get().applySaleSideEffects({ ...prev, status: "paid" });
            }
            if (
              prev.status === "paid" &&
              (status === "cancelled" || status === "refunded")
            ) {
              const retByProduct = new Map<string, number>();
              for (const item of prev.items) {
                retByProduct.set(item.productId, (retByProduct.get(item.productId) ?? 0) + item.quantity);
              }
              for (const [pid, qty] of retByProduct) {
                await get().adjustStock(
                  pid,
                  qty,
                  "return",
                  prev.cashier,
                  status === "refunded" ? "Refund" : "Pembatalan",
                  prev.number
                );
              }
              if (prev.customerId) {
                await get().updateCustomerStats(prev.customerId, -prev.total, -1);
              }
            }
          }
          return;
        }

        try {
          if (exists) {
            const { error } = await supabase
              .from('transactions')
              .update({ status })
              .eq('id', id);

            if (error) throw error;
          }

          set((s) => ({
            transactions: s.transactions.map((t) =>
              t.id === id ? { ...t, status } : t
            ),
          }));

          // Di Supabase mode, DB trigger menangani side effects.
          // Di demo mode, frontend yang menangani.
          if (!isSupabaseReady && exists) {
            if (prev.status === "pending" && status === "paid") {
              await get().applySaleSideEffects({ ...prev, status: "paid" });
            }
            if (
              prev.status === "paid" &&
              (status === "cancelled" || status === "refunded")
            ) {
              const retByProduct = new Map<string, number>();
              for (const item of prev.items) {
                retByProduct.set(item.productId, (retByProduct.get(item.productId) ?? 0) + item.quantity);
              }
              for (const [pid, qty] of retByProduct) {
                await get().adjustStock(
                  pid,
                  qty,
                  "return",
                  prev.cashier,
                  status === "refunded" ? "Refund" : "Pembatalan",
                  prev.number
                );
              }
              if (prev.customerId) {
                await get().updateCustomerStats(prev.customerId, -prev.total, -1);
              }
            }
          }
        } catch (error: any) {
          set({ error: humanizeError(error) });
        }
      },

      // E6: lunasi pre-order (partial -> paid). Stok TIDAK decrement ulang â€”
      // sudah direverse saat DP via trigger pending->partial.
      settlePreorder: async (id, method, _remaining) => {
        const prev = get().transactions.find((t) => t.id === id);
        if (!prev) { set({ error: "Transaksi tidak ditemukan." }); return false; }
        try {
          if (isSupabaseReady) {
            const { error } = await supabase
              .from("transactions")
              .update({
                status: "paid",
                payment_status: "paid",
                amount_paid: prev.total,
                payment_method: method,
              })
              .eq("id", id);
            if (error) throw error;
            set((s) => ({
              transactions: s.transactions.map((t) =>
                t.id === id
                  ? { ...t, status: "paid", paymentStatus: "paid", amountPaid: t.total, paymentMethod: method }
                  : t
              ),
            }));
            await get().fetchTransactions();
            return true;
          }
          // demo lokal: status partial di FE tidak decrement stok, jadi pelunasan cukup ubah status
          set((s) => ({
            transactions: s.transactions.map((t) =>
              t.id === id
                ? { ...t, status: "paid", paymentStatus: "paid", amountPaid: t.total, paymentMethod: method }
                : t
            ),
          }));
          return true;
        } catch (error: any) {
          set({ error: humanizeError(error) });
          return false;
        }
      },

      flushOfflineQueue: async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        const pending = await getPendingTransactions();
        if (pending.length === 0) return;
        console.info(`[offline-queue] Flushing ${pending.length} pending transactionsâ€¦`);
        let flushed = 0;
        for (const q of pending) {
          try {
            const saved = await get().saveTransaction(q.tx, (q as QueuedTransaction).storeId);
            if (saved) {
              set((s) => ({
                transactions: s.transactions.filter((t) => t.id !== q.localId),
              }));
              await dequeueTransaction(q.localId);
              flushed++;
            }
          } catch (err) {
            console.error(`[offline-queue] Flush failed for ${q.localId}:`, err);
          }
        }
        if (flushed > 0) {
          console.info(`[offline-queue] Flushed ${flushed}/${pending.length}. Refreshing stateâ€¦`);
          await get().fetchTransactions();
        }
      },

      addStaff: async (s) => {
        if (!isSupabaseReady) {
          set((state) => ({
            staff: [...state.staff, { id: generateLocalId(), ...s, storeId: s.storeId ?? null, active: s.active ?? true }],
          }));
          return;
        }
        const { data: session } = await supabase.auth.getSession();
        try {
          const res = await fetch("/api/staff", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session?.access_token ?? ""}`,
            },
            body: JSON.stringify({ action: "create", ...s, store_id: s.storeId ?? null }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Gagal menambah staff");
          await get().fetchStaff();
        } catch (error: any) {
          set({ error: humanizeError(error) });
          throw error;
        }
      },

      updateStaff: async (id, patch) => {
        if (!isSupabaseReady) {
          set((state) => ({
            staff: state.staff.map((st) => (st.id === id ? { ...st, ...patch } : st)),
          }));
          return;
        }
        const { data: session } = await supabase.auth.getSession();
        try {
          const res = await fetch("/api/staff", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session?.access_token ?? ""}`,
            },
            body: JSON.stringify({ action: "update", id, ...patch, ...(patch.storeId !== undefined ? { store_id: patch.storeId } : {}) }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Gagal memperbarui staff");
          await get().fetchStaff();
        } catch (error: any) {
          set({ error: humanizeError(error) });
          throw error;
        }
      },

      deleteStaff: async (id) => {
        if (!isSupabaseReady) {
          set((state) => ({
            staff: state.staff.filter((st) => st.id !== id),
          }));
          return;
        }
        const { data: session } = await supabase.auth.getSession();
        try {
          const res = await fetch("/api/staff", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session?.access_token ?? ""}`,
            },
            body: JSON.stringify({ action: "delete", id }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Gagal menghapus staff");
          await get().fetchStaff();
        } catch (error: any) {
          set({ error: humanizeError(error) });
          throw error;
        }
      },

      recordCustomItem: async (item) => {
        const existing = get().products.find(
          (p) => p.name.toLowerCase() === item.name.toLowerCase()
        );
        if (existing) return;
        await get().addProduct({
          sku: "CUST-" + Date.now().toString(36).toUpperCase(),
          name: item.name,
          description: "Item custom (auto-recorded dari transaksi)",
          categoryId: get().categories[0]?.id ?? "",
          images: [],
          tags: ["custom"],
          active: true,
          fabric: "",
          care: "",
          stock: 0,
          variants: [{
              id: "vc-" + Date.now().toString(36),
              sku: item.sku,
              name: "Series 1",
              size: "One Size",
              color: "Custom",
              colorCode: "#cccccc",
 sellingPrice: item.unitPrice,
 costPrice: item.costPrice ?? 0,
            }],
        });
      },

      subscribeRealtime: () => {
        if (!isSupabaseReady) return () => {};
        const sid = get().activeStoreId;
        // Scope realtime ke toko aktif; manager-all (null) tanpa filter.
        // variants tak punya store_id -> listener-nya global, patch by id aman (UUID unik).
        const storeFilter = sid ? { filter: `store_id=eq.${sid}` } : {};
        const channel = supabase
          .channel('pos-db-changes')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'products', ...storeFilter },
            (payload) => {
              const p = payload.new as { id: string; stock: number };
              set((s) => ({
                products: s.products.map((prod) =>
                  prod.id === p.id ? { ...prod, stock: p.stock } : prod
                ),
              }));
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'transactions', ...storeFilter },
            async () => {
              await get().fetchTransactions();
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'transactions', ...storeFilter },
            async () => {
              await get().fetchTransactions();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'stock_transfers' },
            async () => {
              await get().fetchTransfers();
            }
          )
          .subscribe();
        return () => { supabase.removeChannel(channel); };
      },
    }),
    {
      name: "kebaya-oma-data",
      version: 2,
      storage: createJSONStorage(() => quotaSafeStorage),
      // Persist irit: foto bukti tetap di Supabase/in-memory, riwayat dibatasi.
      // Mencegah QuotaExceededError yang dulu bikin popup pembayaran stuck.
      partialize: (s) => ({
        products: s.products,
        categories: s.categories,
        customers: s.customers,
        staff: s.staff,
        stores: s.stores,
        shifts: s.shifts,
        transactions: s.transactions.slice(0, 100).map(stripTxForPersist),
        movements: s.movements.slice(0, 200),
      }),
    }
  )
);
