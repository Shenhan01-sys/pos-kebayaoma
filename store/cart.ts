import { create } from "zustand";
import {
  products,
  type Product,
  type Variant,
  type Transaction,
} from "@/lib/dummy";
import { useData } from "@/store/data";

export interface CartLine {
  key: string; // variantId
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  seriesName: string;
  size: string;
  color: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discount: number;
  custom?: boolean;
}

interface CartState {
  lines: CartLine[];
  customerName: string | null;
  discount: number;
  addVariant: (product: Product, variant: Variant, qty?: number) => void;
  addCustomItem: (
    name: string,
    price: number,
    qty?: number,
    series?: { variantId: string; productId: string; seriesName: string; size: string; color: string; costPrice: number; sku: string }
  ) => void;
  setUnitPrice: (key: string, price: number) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  setCustomer: (name: string | null) => void;
  setDiscount: (amount: number) => void;
  clear: () => void;
  subtotal: () => number;
  total: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  customerName: null,
  discount: 0,
  addVariant: (product, variant, qty = 1) =>
    set((state) => {
      const cap = Math.max(0, product.stock ?? 0);
      const existing = state.lines.find((l) => l.variantId === variant.id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + qty, cap);
        if (nextQty <= 0 || nextQty === existing.quantity) return state;
        return {
          lines: state.lines.map((l) =>
            l.variantId === variant.id ? { ...l, quantity: nextQty } : l
          ),
        };
      }
      const startQty = Math.min(qty, cap);
      if (startQty <= 0) return state;
      const line: CartLine = {
        key: variant.id,
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        sku: variant.sku,
        seriesName: variant.name,
        size: variant.size,
        color: variant.color,
        unitPrice: variant.sellingPrice,
        costPrice: variant.costPrice,
        quantity: startQty,
        discount: 0,
      };
      return { lines: [...state.lines, line] };
    }),
  addCustomItem: (name, price, qty = 1, series) =>
    set((state) => {
      const key = "custom-" + Date.now();
      const line: CartLine = {
        key,
        productId: series?.productId ?? "custom",
        variantId: series?.variantId ?? key,
        name,
        sku: series?.sku ?? "CUSTOM",
        seriesName: series?.seriesName ?? "Custom",
        size: series?.size ?? "Custom",
        color: series?.color ?? "—",
        unitPrice: price,
        costPrice: series?.costPrice ?? 0,
        quantity: qty,
        discount: 0,
        custom: true,
      };
      return { lines: [...state.lines, line] };
    }),
  setUnitPrice: (key, price) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.variantId === key ? { ...l, unitPrice: Math.max(0, price) } : l
      ),
    })),
  inc: (key) =>
    set((s) => ({
      lines: s.lines.map((l) => {
        if (l.variantId !== key) return l;
        if (l.custom && l.productId === "custom") return { ...l, quantity: l.quantity + 1 };
        const stock = useData.getState().products.find((p) => p.id === l.productId)?.stock;
        if (stock !== undefined && l.quantity + 1 > stock) return l; // mentok stok
        return { ...l, quantity: l.quantity + 1 };
      }),
    })),
  dec: (key) =>
    set((s) => ({
      lines: s.lines
        .map((l) =>
          l.variantId === key ? { ...l, quantity: l.quantity - 1 } : l
        )
        .filter((l) => l.quantity > 0),
    })),
  setQty: (key, qty) =>
    set((s) => ({
      lines: s.lines
        .map((l) => {
          if (l.variantId !== key) return l;
          let next = Math.max(0, qty);
          if (!(l.custom && l.productId === "custom")) {
            const stock = useData.getState().products.find((p) => p.id === l.productId)?.stock;
            if (stock !== undefined) next = Math.min(next, Math.max(0, stock));
          }
          return { ...l, quantity: next };
        })
        .filter((l) => l.quantity > 0),
    })),
  remove: (key) =>
    set((s) => ({ lines: s.lines.filter((l) => l.variantId !== key) })),
  setCustomer: (name) => set({ customerName: name }),
  setDiscount: (amount) => set({ discount: Math.max(0, amount) }),
  clear: () => set({ lines: [], customerName: null, discount: 0 }),
  subtotal: () =>
    get().lines.reduce((s, l) => s + l.unitPrice * l.quantity - l.discount, 0),
  total: () => Math.max(0, get().subtotal() - get().discount),
}));

// Transaction log — disimpan ke Supabase via useData; dummy sebagai fallback
const overrides = new Map<string, Transaction["status"]>();
const listeners = new Set<() => void>();

export function getTransactions(): Transaction[] {
  return useData.getState().transactions;
}

export function getAllTransactions(dummy: Transaction[]): Transaction[] {
  const base = [...useData.getState().transactions, ...dummy];
  return base.map((t) =>
    overrides.has(t.id) ? { ...t, status: overrides.get(t.id)! } : t
  );
}

export async function addTransaction(
  t: Omit<Transaction, "id" | "items"> & { items: Transaction["items"] }
): Promise<Transaction | null> {
  const saved = await useData.getState().saveTransaction(t);
  listeners.forEach((l) => l());
  return saved;
}

export function setTransactionStatus(id: string, status: Transaction["status"]) {
  overrides.set(id, status);
  listeners.forEach((l) => l());
  useData.getState().setTransactionStatus(id, status);
}

export function subscribeTransactions(l: () => void) {
  listeners.add(l);
  const unsub = useData.subscribe((state, prev) => {
    if (state.transactions !== prev.transactions) l();
  });
  return () => {
    listeners.delete(l);
    unsub();
  };
}

export function nextTxNumber(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePrefix = `TRX-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
    d.getDate()
  )}-`;
  const seq =
    useData
      .getState()
      .transactions.filter((t) => t.number.startsWith(datePrefix)).length + 1;
  return `${datePrefix}${String(seq).padStart(3, "0")}`;
}

export { products };
