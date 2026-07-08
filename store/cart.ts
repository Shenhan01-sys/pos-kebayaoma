import { create } from "zustand";
import {
  products,
  type Product,
  type Variant,
  type Transaction,
} from "@/lib/dummy";

export interface CartLine {
  key: string; // variantId
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  discount: number;
}

interface CartState {
  lines: CartLine[];
  customerName: string | null;
  discount: number;
  addVariant: (product: Product, variant: Variant, qty?: number) => void;
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
      const existing = state.lines.find((l) => l.variantId === variant.id);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.variantId === variant.id
              ? { ...l, quantity: l.quantity + qty }
              : l
          ),
        };
      }
      const line: CartLine = {
        key: variant.id,
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        unitPrice: variant.sellingPrice,
        quantity: qty,
        discount: 0,
      };
      return { lines: [...state.lines, line] };
    }),
  inc: (key) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.variantId === key ? { ...l, quantity: l.quantity + 1 } : l
      ),
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
        .map((l) => (l.variantId === key ? { ...l, quantity: Math.max(0, qty) } : l))
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

// In-memory transaction log (dummy, replaced by Supabase later)
let txLog: Transaction[] = [];
const overrides = new Map<string, Transaction["status"]>();
const listeners = new Set<() => void>();

export function getTransactions(): Transaction[] {
  return txLog;
}

export function getAllTransactions(dummy: Transaction[]): Transaction[] {
  const base = [...txLog, ...dummy];
  return base.map((t) =>
    overrides.has(t.id) ? { ...t, status: overrides.get(t.id)! } : t
  );
}

export function addTransaction(t: Transaction) {
  txLog = [t, ...txLog];
  listeners.forEach((l) => l());
}

export function setTransactionStatus(id: string, status: Transaction["status"]) {
  overrides.set(id, status);
  listeners.forEach((l) => l());
}

export function subscribeTransactions(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function nextTxNumber(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const seq = String(txLog.length + 1).padStart(3, "0");
  return `TRX-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
    d.getDate()
  )}-${seq}`;
}

export { products };
