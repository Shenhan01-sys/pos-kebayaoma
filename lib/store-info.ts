// lib/store-info.ts — alamat/telepon nota: data toko dari DB (Pengaturan, superadmin) lebih utama daripada
// isian lokal perangkat (localStorage, default dummy). Murni agar teruji.

export interface ReceiptStoreInfo {
  storeName: string;
  address: string;
  phone: string;
}

interface StoreRowLike {
  id: string;
  address?: string | null;
  phone?: string | null;
}

const clean = (v?: string | null) => (v ?? "").trim();

/** nama toko dari pengaturan lokal; alamat & telepon dari baris toko (DB) bila terisi, selain itu cadangan lokal */
export function resolveReceiptStore(
  local: ReceiptStoreInfo,
  stores: StoreRowLike[],
  storeId?: string | null
): ReceiptStoreInfo {
  const row = storeId ? stores.find((s) => s.id === storeId) : undefined;
  return {
    storeName: local.storeName,
    address: clean(row?.address) || local.address,
    phone: clean(row?.phone) || local.phone,
  };
}
