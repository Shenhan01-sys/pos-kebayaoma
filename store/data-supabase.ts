"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import type { Product, Variant, Category, Customer } from "@/lib/dummy";

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
  loading: boolean;
  error: string | null;

  // fetch
  fetchProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCustomers: () => Promise<void>;

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
  addStaff: (s: Omit<Staff, "id">) => void;
  updateStaff: (id: string, patch: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;
}

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      customers: [],
      staff: [
        { id: "st1", name: "Ani", pin: "1234", role: "admin", active: true },
        { id: "st2", name: "Budi", pin: "2345", role: "cashier", active: true },
        { id: "st3", name: "Citra", pin: "3456", role: "manager", active: true },
      ],
      movements: [],
      loading: false,
      error: null,

      fetchProducts: async () => {
        set({ loading: true, error: null });
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
            visitCount: c.visit_count
          }));

          set({ customers, loading: false });
        } catch (error: any) {
          set({ error: error.message, loading: false });
        }
      },

      addCategory: async (c) => {
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
              store_id: process.env.NEXT_PUBLIC_STORE_ID
            }])
            .select()
            .single();

          if (productError) throw productError;

          // Insert variants
          const variants = p.variants.map(v => ({
            ...v,
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
          const { error } = await supabase
            .from('products')
            .update(patch)
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p))
          }));
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      deleteProduct: async (id) => {
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

      adjustStock: async (variantId, quantity, type, staff, reason, note) => {
        try {
          // Update variant stock
          const product = get().products.find((p) =>
            p.variants.some((v) => v.id === variantId)
          );
          const variant = product?.variants.find((v) => v.id === variantId);

          if (!product || !variant) return;

          const newStock = Math.max(0, variant.stock + quantity);

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
        try {
          const { data, error } = await supabase
            .from('customers')
            .insert([{
              name: c.name,
              phone: c.phone,
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
              visitCount: data.visit_count
            }]
          }));
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      updateCustomer: async (id, patch) => {
        try {
          const { error } = await supabase
            .from('customers')
            .update(patch)
            .eq('id', id);

          if (error) throw error;

          set((s) => ({
            customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c))
          }));
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      deleteCustomer: async (id) => {
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

      addStaff: (st) =>
        set((s) => ({ staff: [...s.staff, { ...st, id: `st-${Date.now()}` }] })),

      updateStaff: (id, patch) =>
        set((s) => ({
          staff: s.staff.map((st) => (st.id === id ? { ...st, ...patch } : st))
        })),

      deleteStaff: (id) =>
        set((s) => ({ staff: s.staff.filter((st) => st.id !== id) })),
    }),
    { name: "kebaya-oma-data" }
  )
);
