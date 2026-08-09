"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import type {
  Product,
  Variant,
  Category,
  Customer,
  Transaction,
  TransactionItem,
} from "@/lib/dummy";

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
  loading: boolean;
  error: string | null;

  // fetch
  fetchProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCustomers: () => Promise<void>;
  fetchStaff: () => Promise<void>;
  fetchTransactions: () => Promise<void>;

  // transactions
  saveTransaction: (tx: Omit<Transaction, "id" | "items"> & { items: TransactionItem[] }) => Promise<Transaction | null>;
  setTransactionStatus: (id: string, status: Transaction["status"]) => Promise<void>;

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

      fetchStaff: async () => {
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

      saveTransaction: async (tx) => {
        try {
          const customer = tx.customerName
            ? get().customers.find((c) => c.name === tx.customerName)
            : undefined;

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

          return saved;
        } catch (error: any) {
          set({ error: error.message });
          return null;
        }
      },

      setTransactionStatus: async (id, status) => {
        try {
          const prev = get().transactions.find((t) => t.id === id);
          const exists = !!prev;
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

          // Batal/refund dari status paid → kembalikan stok (movement return)
          if (
            exists &&
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
          }
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      addStaff: async (s) => {
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
    }),
    { name: "kebaya-oma-data" }
  )
);
