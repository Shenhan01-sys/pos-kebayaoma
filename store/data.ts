"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { getPowerSyncDb, initPowerSync, isPowerSyncReady } from "@/lib/powersync/client";
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
  type Shift,
} from "@/lib/dummy";

const generateLocalId = () => "local-" + Math.random().toString(36).slice(2, 10);
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? "demo-store";

function safeJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  if (Array.isArray(value)) return value as unknown as T;
  return fallback;
}

// Inisialisasi PowerSync saat module load (lazy, non-blocking)
if (typeof window !== "undefined") {
  initPowerSync().catch(() => {});
}

export type Role = "admin" | "manager" | "cashier";

export interface Staff {
  id: string;
  name: string;
  pin?: string;
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
  transactions: Transaction[];
  shifts: Shift[];
  loading: boolean;
  error: string | null;

  // fetch
  fetchProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCustomers: () => Promise<void>;
  fetchStaff: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchShifts: () => Promise<void>;

  // transactions
  saveTransaction: (tx: Omit<Transaction, "id" | "items"> & { items: TransactionItem[] }) => Promise<Transaction | null>;
  setTransactionStatus: (id: string, status: Transaction["status"]) => Promise<void>;

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

  // stock
  adjustStock: (
    variantId: string,
    quantity: number,
    type: MovementType,
    staff: string,
    reason?: string,
    note?: string
  ) => Promise<void>;

  // customers
  addCustomer: (c: Omit<Customer, "id">) => Promise<void>;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // staff
  addStaff: (s: { name: string; pin: string; role: Role; phone?: string; active: boolean }) => Promise<void>;
  updateStaff: (id: string, patch: { name?: string; pin?: string; role?: Role; phone?: string; active?: boolean }) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;

  // realtime
  subscribeRealtime: () => void;

  // fallback
  loadFallback: () => void;
}

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      customers: [],
      staff: [],
      movements: [],
      transactions: [],
      shifts: [],
      loading: false,
      error: null,

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
            { id: "demo-admin", name: "Demo Admin", role: "admin", active: true },
            { id: "demo-cashier", name: "Demo Cashier", role: "cashier", active: true },
            { id: "demo-manager", name: "Demo Manager", role: "manager", active: true },
          ],
        });
      },

      fetchProducts: async () => {
        set({ loading: true, error: null });

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              `SELECT * FROM products WHERE store_id = ? ORDER BY name`,
              [STORE_ID]
            ) as Record<string, any>[];
            const products: Product[] = [];
            for (const p of rows) {
              const vRows = await psDb.getAll(
                `SELECT * FROM variants WHERE product_id = ?`,
                [p.id]
              ) as Record<string, any>[];
              products.push({
                id: p.id,
                sku: p.sku,
                name: p.name,
                description: p.description,
                categoryId: p.category_id,
                images: safeJson(p.images, []),
                tags: safeJson(p.tags, []),
                active: Boolean(p.active),
                fabric: p.fabric,
                care: p.care,
                season: p.season ?? undefined,
                brand: p.brand ?? undefined,
                compareAt: p.compare_at ?? undefined,
                variants: vRows.map((v: any) => ({
                  id: v.id,
                  sku: v.sku,
                  size: v.size,
                  color: v.color,
                  colorCode: v.color_code,
                  stock: v.stock,
                  sellingPrice: v.selling_price,
                  costPrice: v.cost_price,
                  barcode: v.barcode,
                })),
              });
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
          const { data, error } = await supabase
            .from('products')
            .select(`
              *,
              variants (*)
            `)
            .order('name');

          if (error) throw error;

          // Transform Supabase data to match dummy.ts types
          const products = data.map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: p.description,
            categoryId: p.category_id,
            images: p.images || [],
            tags: p.tags || [],
            active: p.active,
            fabric: p.fabric,
            care: p.care,
            season: p.season ?? undefined,
            brand: p.brand ?? undefined,
            compareAt: p.compare_at ?? undefined,
            variants: p.variants.map((v: any) => ({
              id: v.id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              colorCode: v.color_code,
              stock: v.stock,
              sellingPrice: v.selling_price,
              costPrice: v.cost_price,
              barcode: v.barcode
            }))
          }));

          set({ products, loading: false });
        } catch (error: any) {
          set({ error: error.message, loading: false });
        }
      },

      fetchCategories: async () => {
        set({ loading: true, error: null });

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              `SELECT * FROM categories WHERE store_id = ? ORDER BY name`,
              [STORE_ID]
            ) as Record<string, any>[];
            const categories = rows.map((c: any) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
            }));
            set({ categories, loading: false });
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
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');

          if (error) throw error;

          const categories = data.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug
          }));

          set({ categories, loading: false });
        } catch (error: any) {
          set({ error: error.message, loading: false });
        }
      },

      fetchCustomers: async () => {
        set({ loading: true, error: null });

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              `SELECT * FROM customers WHERE store_id = ? ORDER BY name`,
              [STORE_ID]
            ) as Record<string, any>[];
            const customers = rows.map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              totalPurchases: c.total_purchases ?? 0,
              visitCount: c.visit_count ?? 0,
              email: c.email ?? undefined,
              address: c.address ?? undefined,
              birthday: c.birthday ?? undefined,
              notes: c.notes ?? undefined,
              tags: safeJson(c.tags, []),
            }));
            set({ customers, loading: false });
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
          const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name');

          if (error) throw error;

          const customers = data.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            totalPurchases: c.total_purchases,
            visitCount: c.visit_count,
            email: c.email ?? undefined,
            address: c.address ?? undefined,
            birthday: c.birthday ?? undefined,
            notes: c.notes ?? undefined,
            tags: c.tags ?? []
          }));

          set({ customers, loading: false });
        } catch (error: any) {
          set({ error: error.message, loading: false });
        }
      },

      addCategory: async (c) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO categories (id, store_id, name, slug) VALUES (?, ?, ?, ?)`,
            [id, STORE_ID, c.name, c.slug]
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
            .insert([{ name: c.name, slug: c.slug, store_id: process.env.NEXT_PUBLIC_STORE_ID }])
            .select()
            .single();

          if (error) throw error;

          set((s) => ({
            categories: [...s.categories, { id: data.id, name: data.name, slug: data.slug }]
          }));
        } catch (error: any) {
          set({ error: error.message });
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
          set({ error: error.message });
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
          set({ error: error.message });
        }
      },

      addProduct: async (p) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO products (id, store_id, sku, name, description, category_id, images, tags, active, fabric, care, season, brand, compare_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, STORE_ID, p.sku, p.name, p.description ?? null, p.categoryId ?? null, JSON.stringify(p.images ?? []), JSON.stringify(p.tags ?? []), p.active ? 1 : 0, p.fabric ?? null, p.care ?? null, p.season ?? null, p.brand ?? null, p.compareAt ?? null]
          );
          for (const v of p.variants) {
            const vid = v.id || generateLocalId();
            await psDb.execute(
              `INSERT INTO variants (id, product_id, sku, size, color, color_code, stock, selling_price, cost_price, barcode)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [vid, id, v.sku, v.size, v.color, v.colorCode ?? null, v.stock, v.sellingPrice, v.costPrice, v.barcode ?? null]
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
          const { data: product, error: productError } = await supabase
            .from('products')
            .insert([{
              sku: p.sku,
              name: p.name,
              description: p.description,
              category_id: p.categoryId,
              images: p.images,
              tags: p.tags,
              active: p.active,
              fabric: p.fabric,
              care: p.care,
              season: p.season ?? null,
              brand: p.brand ?? null,
              compare_at: p.compareAt ?? null,
              store_id: process.env.NEXT_PUBLIC_STORE_ID
            }])
            .select()
            .single();

          if (productError) throw productError;

          // Insert variants
          const variants = p.variants.map(v => ({
            sku: v.sku,
            size: v.size,
            color: v.color,
            color_code: v.colorCode,
            stock: v.stock,
            selling_price: v.sellingPrice,
            cost_price: v.costPrice,
            barcode: v.barcode ?? null,
            product_id: product.id
          }));

          const { error: variantsError } = await supabase
            .from('variants')
            .insert(variants);

          if (variantsError) throw variantsError;

          // Refresh products
          await get().fetchProducts();
        } catch (error: any) {
          set({ error: error.message });
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
            ...(rest.fabric !== undefined && { fabric: rest.fabric }),
            ...(rest.care !== undefined && { care: rest.care }),
            ...(rest.season !== undefined && { season: rest.season ?? null }),
            ...(rest.brand !== undefined && { brand: rest.brand ?? null }),
            ...(rest.compareAt !== undefined && { compare_at: rest.compareAt ?? null }),
          };

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
                    size: v.size,
                    color: v.color,
                    color_code: v.colorCode,
                    stock: v.stock,
                    selling_price: v.sellingPrice,
                    cost_price: v.costPrice,
                    barcode: v.barcode ?? null,
                    product_id: id,
                  }]);
                if (insErr) throw insErr;
              } else {
                const { error: updErr } = await supabase
                  .from('variants')
                  .update({
                    sku: v.sku,
                    size: v.size,
                    color: v.color,
                    color_code: v.colorCode,
                    stock: v.stock,
                    selling_price: v.sellingPrice,
                    cost_price: v.costPrice,
                    barcode: v.barcode,
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

          // Refresh products
          await get().fetchProducts();
        } catch (error: any) {
          set({ error: error.message });
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
          set({ error: error.message });
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
          set({ error: error.message });
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
          set({ error: error.message });
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
          set({ error: error.message });
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
          set({ error: error.message });
        }
      },

      applySaleSideEffects: async (tx: Transaction) => {
        // Kurangi stok per item
        for (const item of tx.items) {
          await get().adjustStock(
            item.variantId,
            -item.quantity,
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

      adjustStock: async (variantId, quantity, type, staff, reason, note) => {
        const product = get().products.find((p) =>
          p.variants.some((v) => v.id === variantId)
        );
        const variant = product?.variants.find((v) => v.id === variantId);
        if (!product || !variant) return;

        const newStock = Math.max(0, variant.stock + quantity);

        const psDb = getPowerSyncDb();
        if (psDb) {
          await psDb.execute(`UPDATE variants SET stock = ? WHERE id = ?`, [newStock, variantId]);
          await psDb.execute(
            `INSERT INTO stock_movements (id, store_id, variant_id, sku, product_name, type, quantity, reason, note, staff, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [generateLocalId(), STORE_ID, variantId, variant.sku, product.name, type, quantity, reason ?? null, note ?? null, staff]
          );
          set((s) => ({
            products: s.products.map((p) =>
              p.id === product.id
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
                id: `mv-${Date.now()}`,
                variantId,
                sku: variant.sku,
                productName: product.name,
                type,
                quantity,
                reason,
                note,
                staff,
                createdAt: new Date().toISOString(),
              },
              ...s.movements,
            ],
          }));
          return;
        }

        if (!isSupabaseReady) {
          set((s) => ({
            products: s.products.map((p) =>
              p.id === product.id
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
                id: `mv-${Date.now()}`,
                variantId,
                sku: variant.sku,
                productName: product.name,
                type,
                quantity,
                reason,
                note,
                staff,
                createdAt: new Date().toISOString(),
              },
              ...s.movements,
            ],
          }));
          return;
        }

        try {
          const { error: updateError } = await supabase
            .from('variants')
            .update({ stock: newStock })
            .eq('id', variantId);

          if (updateError) throw updateError;

          // Insert stock movement
          await supabase
            .from('stock_movements')
            .insert([{
              variant_id: variantId,
              sku: variant.sku,
              product_name: product.name,
              type,
              quantity,
              reason,
              note,
              staff,
              store_id: process.env.NEXT_PUBLIC_STORE_ID
            }]);

          // Update local state
          set((s) => ({
            products: s.products.map((p) =>
              p.id === product.id
                ? {
                    ...p,
                    variants: p.variants.map((x) =>
                      x.id === variantId ? { ...x, stock: newStock } : x
                    )
                  }
                : p
            ),
            movements: [
              {
                id: `mv-${Date.now()}`,
                variantId,
                sku: variant.sku,
                productName: product.name,
                type,
                quantity,
                reason,
                note,
                staff,
                createdAt: new Date().toISOString()
              },
              ...s.movements
            ]
          }));
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      addCustomer: async (c) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO customers (id, store_id, name, phone, email, address, birthday, notes, tags, total_purchases, visit_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, STORE_ID, c.name, c.phone ?? null, c.email ?? null, c.address ?? null, c.birthday ?? null, c.notes ?? null, JSON.stringify(c.tags ?? []), 0, 0]
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
              birthday: c.birthday ?? null,
              notes: c.notes ?? null,
              tags: c.tags ?? [],
              store_id: process.env.NEXT_PUBLIC_STORE_ID
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
          set({ error: error.message });
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
            ...(patch.birthday !== undefined && { birthday: patch.birthday ?? null }),
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
          set({ error: error.message });
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
          set({ error: error.message });
        }
      },

      fetchStaff: async () => {
        set({ loading: true, error: null });

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              `SELECT * FROM staff WHERE store_id = ? ORDER BY name`,
              [STORE_ID]
            ) as Record<string, any>[];
            const staff = rows.map((st: any) => ({
              id: st.id,
              name: st.name,
              role: st.role,
              phone: st.phone,
              active: Boolean(st.active),
            }));
            set({ staff, loading: false });
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
          const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('name');

          if (error) throw error;

          const staff = data.map((st) => ({
            id: st.id,
            name: st.name,
            role: st.role,
            phone: st.phone,
            active: st.active,
          }));

          set({ staff });
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      fetchTransactions: async () => {
        set({ loading: true, error: null });

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              `SELECT * FROM transactions WHERE store_id = ? ORDER BY created_at DESC LIMIT 500`,
              [STORE_ID]
            ) as Record<string, any>[];
            const transactions = [];
            for (const t of rows) {
              const iRows = await psDb.getAll(
                `SELECT * FROM transaction_items WHERE transaction_id = ?`,
                [t.id]
              ) as Record<string, any>[];
              transactions.push({
                id: t.id,
                number: t.number,
                cashier: t.cashier,
                customerId: t.customer_id ?? undefined,
                customerName: t.customer_name ?? undefined,
                status: t.status,
                paymentMethod: t.payment_method,
                paymentStatus: t.payment_status,
                subtotal: t.subtotal,
                tax: t.tax,
                discount: t.discount,
                total: t.total,
                amountPaid: t.amount_paid,
                change: t.change,
                qrisRef: t.qris_ref ?? undefined,
                createdAt: t.created_at,
                items: iRows.map((i: any) => ({
                  productId: i.product_id,
                  variantId: i.variant_id,
                  name: i.name,
                  sku: i.sku,
                  size: i.size,
                  color: i.color,
                  quantity: i.quantity,
                  unitPrice: i.unit_price,
                  discount: i.discount,
                  total: i.total,
                })),
              });
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
          const { data, error } = await supabase
            .from('transactions')
            .select(`
              *,
              transaction_items (*)
            `)
            .order('created_at', { ascending: false })
            .limit(500);

          if (error) throw error;

          const transactions = data.map((t) => ({
            id: t.id,
            number: t.number,
            cashier: t.cashier,
            customerId: t.customer_id ?? undefined,
            customerName: t.customer_name ?? undefined,
            status: t.status,
            paymentMethod: t.payment_method,
            paymentStatus: t.payment_status,
            subtotal: t.subtotal,
            tax: t.tax,
            discount: t.discount,
            total: t.total,
            amountPaid: t.amount_paid,
            change: t.change,
            qrisRef: t.qris_ref ?? undefined,
            createdAt: t.created_at,
            items: (t.transaction_items ?? []).map((i: any) => ({
              productId: i.product_id,
              variantId: i.variant_id,
              name: i.name,
              sku: i.sku,
              size: i.size,
              color: i.color,
              quantity: i.quantity,
              unitPrice: i.unit_price,
              discount: i.discount,
              total: i.total,
            })),
          }));

          set({ transactions });
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      fetchShifts: async () => {
        set({ loading: true, error: null });

        const psDb = getPowerSyncDb();
        if (psDb) {
          try {
            const rows = await psDb.getAll(
              `SELECT * FROM shifts WHERE store_id = ? ORDER BY opened_at DESC LIMIT 100`,
              [STORE_ID]
            ) as Record<string, any>[];
            const shifts = rows.map((s: any) => ({
              id: s.id,
              staff_name: s.staff_name,
              opened_at: s.opened_at,
              closed_at: s.closed_at ?? undefined,
              startingCash: s.starting_cash,
              endingCash: s.ending_cash ?? undefined,
              totalTransactions: s.total_transactions,
              totalSales: s.total_sales,
              totalQris: s.total_qris,
              totalCash: s.total_cash,
              status: s.status,
            }));
            set({ shifts, loading: false });
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
          const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .order('opened_at', { ascending: false })
            .limit(100);

          if (error) throw error;

          const shifts = data.map((s) => ({
            id: s.id,
            staff_name: s.staff_name,
            opened_at: s.opened_at,
            closed_at: s.closed_at ?? undefined,
            startingCash: s.starting_cash,
            endingCash: s.ending_cash ?? undefined,
            totalTransactions: s.total_transactions,
            totalSales: s.total_sales,
            totalQris: s.total_qris,
            totalCash: s.total_cash,
            status: s.status,
          }));

          set({ shifts });
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      openShift: async (startingCash, staffName) => {
        const psDb = getPowerSyncDb();
        if (psDb) {
          const id = generateLocalId();
          await psDb.execute(
            `INSERT INTO shifts (id, store_id, staff_name, opened_at, starting_cash, status, total_transactions, total_sales, total_qris, total_cash)
             VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)`,
            [id, STORE_ID, staffName, startingCash, "open", 0, 0, 0, 0]
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
              store_id: process.env.NEXT_PUBLIC_STORE_ID,
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
          set({ error: error.message });
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
          set({ error: error.message });
        }
      },

      currentShift: () => {
        return get().shifts.find((s) => s.status === "open");
      },

      saveTransaction: async (tx) => {
        try {
          const customer = tx.customerName
            ? get().customers.find((c) => c.name === tx.customerName)
            : undefined;

          const psDb = getPowerSyncDb();
          if (psDb) {
            const id = generateLocalId();
            await psDb.execute(
              `INSERT INTO transactions (id, store_id, number, cashier, customer_id, customer_name, status, payment_method, payment_status, subtotal, tax, discount, total, amount_paid, change, qris_ref, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              [id, STORE_ID, tx.number, tx.cashier, customer?.id ?? null, tx.customerName ?? null, tx.status, tx.paymentMethod, tx.paymentStatus, tx.subtotal, tx.tax, tx.discount, tx.total, tx.amountPaid, tx.change, tx.qrisRef ?? null]
            );
            for (const i of tx.items) {
              await psDb.execute(
                `INSERT INTO transaction_items (id, transaction_id, product_id, variant_id, name, sku, size, color, quantity, unit_price, discount, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [generateLocalId(), id, i.productId, i.variantId, i.name, i.sku, i.size, i.color, i.quantity, i.unitPrice, i.discount, i.total]
              );
            }
            const saved: Transaction = { ...tx, id, customerId: customer?.id, createdAt: new Date().toISOString() };
            set((s) => ({ transactions: [saved, ...s.transactions] }));
            // Di PowerSync mode, DB trigger Supabase menangani side effects setelah sync.
            // Kalau offline, stok tetap di-update lokal via adjustStock di sini jika perlu.
            return saved;
          }

          if (!isSupabaseReady) {
            const saved: Transaction = {
              ...tx,
              id: generateLocalId(),
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

          const { data: header, error: headerError } = await supabase
            .from('transactions')
            .insert([{
              store_id: process.env.NEXT_PUBLIC_STORE_ID,
              number: tx.number,
              cashier: tx.cashier,
              customer_id: customer?.id ?? null,
              customer_name: tx.customerName ?? null,
              status: tx.status,
              payment_method: tx.paymentMethod,
              payment_status: tx.paymentStatus,
              subtotal: tx.subtotal,
              tax: tx.tax,
              discount: tx.discount,
              total: tx.total,
              amount_paid: tx.amountPaid,
              change: tx.change,
              qris_ref: tx.qrisRef ?? null,
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
              discount: i.discount,
              total: i.total,
            })));

          if (itemsError) throw itemsError;

          const saved: Transaction = {
            id: header.id,
            number: header.number,
            cashier: header.cashier,
            customerId: header.customer_id ?? undefined,
            customerName: header.customer_name ?? undefined,
            status: header.status,
            paymentMethod: header.payment_method,
            paymentStatus: header.payment_status,
            subtotal: header.subtotal,
            tax: header.tax,
            discount: header.discount,
            total: header.total,
            amountPaid: header.amount_paid,
            change: header.change,
            qrisRef: header.qris_ref ?? undefined,
            createdAt: header.created_at,
            items: tx.items,
          };

          set((s) => ({
            transactions: [saved, ...s.transactions.filter((x) => x.id !== saved.id)],
          }));

          if (!isSupabaseReady && saved.status === "paid") {
            await get().applySaleSideEffects(saved);
          }

          return saved;
        } catch (error: any) {
          set({ error: error.message });
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
              for (const item of prev.items) {
                await get().adjustStock(
                  item.variantId,
                  item.quantity,
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
              for (const item of prev.items) {
                await get().adjustStock(
                  item.variantId,
                  item.quantity,
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
              for (const item of prev.items) {
                await get().adjustStock(
                  item.variantId,
                  item.quantity,
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
          set({ error: error.message });
        }
      },

      addStaff: async (s) => {
        if (!isSupabaseReady) {
          set((state) => ({
            staff: [...state.staff, { id: generateLocalId(), ...s, active: s.active ?? true }],
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
            body: JSON.stringify({ action: "create", ...s }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Gagal menambah staff");
          await get().fetchStaff();
        } catch (error: any) {
          set({ error: error.message });
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
            body: JSON.stringify({ action: "update", id, ...patch }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Gagal memperbarui staff");
          await get().fetchStaff();
        } catch (error: any) {
          set({ error: error.message });
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
          set({ error: error.message });
        }
      },

      subscribeRealtime: () => {
        if (!isSupabaseReady) return () => {};
        supabase
          .channel('pos-db-changes')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'variants' },
            (payload) => {
              const v = payload.new as { id: string; stock: number };
              set((s) => ({
                products: s.products.map((p) => ({
                  ...p,
                  variants: p.variants.map((x) =>
                    x.id === v.id ? { ...x, stock: v.stock } : x
                  ),
                })),
              }));
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'transactions' },
            async () => {
              // DB trigger menangani side effects (stok & customer stats).
              // Frontend cukup refresh data.
              await get().fetchTransactions();
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'transactions' },
            async () => {
              // DB trigger menangani side effects.
              await get().fetchTransactions();
            }
          )
          .subscribe();
      },
    }),
    { name: "kebaya-oma-data" }
  )
);
