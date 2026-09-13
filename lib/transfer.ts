// lib/transfer.ts — E1: logika murni (guard kirim + pengelompokan view Gabungan)
export interface TransferLike {
  id: string;
  fromStore: string;
  toStore: string;
  qty: number;
  status: "pending" | "sent" | "cancelled";
}

// AC-E1a#6 (UI layer): hanya toko PENGIRIM atau manager-all yang boleh menekan Kirim.
export function canSendTransfer(
  t: Pick<TransferLike, "fromStore">,
  activeStoreId: string | null,
  isManagerAll: boolean
): boolean {
  if (isManagerAll) return true;
  return activeStoreId !== null && activeStoreId === t.fromStore;
}

export function canCancelTransfer(t: TransferLike, activeStoreId: string | null, isManagerAll: boolean): boolean {
  if (isManagerAll) return true;
  return activeStoreId === t.fromStore || activeStoreId === t.toStore;
}

export interface SkuRow {
  sku: string;
  name: string;
  byStore: Record<string, number>;
  total: number;
}

// AC-E1b#1: 1 baris per SKU (case-insensitive), kolom stok per toko, Total = jumlah.
export function groupBySku<T extends { sku: string; name: string; stock: number; storeId?: string | null }>(
  products: T[],
  storeIds: string[]
): SkuRow[] {
  const map = new Map<string, SkuRow>();
  for (const p of products) {
    const key = p.sku.toLowerCase();
    const row = map.get(key) ?? { sku: p.sku, name: p.name, byStore: {}, total: 0 };
    const sid = p.storeId ?? "—";
    row.byStore[sid] = (row.byStore[sid] ?? 0) + (p.stock ?? 0);
    row.total += p.stock ?? 0;
    map.set(key, row);
  }
  void storeIds;
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
