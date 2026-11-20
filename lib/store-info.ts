// lib/store-info.ts — alamat/telepon nota: data toko dari DB (Pengaturan, superadmin) lebih utama daripada
// isian lokal perangkat (localStorage, default dummy). Murni agar teruji.
// 2026-11-20 (revisi toko): nilai dummy bawaan ("Jl. Sudirman No. 123, Jakarta" / "021-1234-5678") dianggap
// kosong di mana pun asalnya, dan tiap outlet punya alamat resmi bawaan bila DB belum diisi.

export interface ReceiptStoreInfo {
  storeName: string;
  address: string;
  phone: string;
}

interface StoreRowLike {
  id: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

/** nilai contoh bawaan aplikasi — bukan data toko */
const DUMMY_VALUES = new Set(["jl. sudirman no. 123, jakarta", "021-1234-5678"]);

/** alamat resmi outlet (dari toko, 17 Nov 2026) — dipakai bila kolom alamat DB kosong/dummy */
const OUTLET_ADDRESS: [RegExp, string][] = [
  [/monjali/i, "Jalan Monjali 55, Yogyakarta"],
  [/kota\s*baru|cokrodipuran/i, "Cokrodipuran 6, Yogyakarta"],
];

const real = (v?: string | null) => {
  const t = (v ?? "").trim();
  return DUMMY_VALUES.has(t.toLowerCase()) ? "" : t;
};

/** alamat resmi bawaan untuk outlet berdasarkan nama toko; "" bila tak dikenal */
export function outletAddress(storeName?: string | null): string {
  const n = storeName ?? "";
  return OUTLET_ADDRESS.find(([re]) => re.test(n))?.[1] ?? "";
}

/** nama toko dari pengaturan lokal; alamat: DB → alamat resmi outlet → isian lokal; telepon: DB → lokal (dummy dibuang) */
export function resolveReceiptStore(
  local: ReceiptStoreInfo,
  stores: StoreRowLike[],
  storeId?: string | null
): ReceiptStoreInfo {
  const row = storeId ? stores.find((s) => s.id === storeId) : undefined;
  return {
    storeName: local.storeName,
    address: real(row?.address) || outletAddress(row?.name) || real(local.address),
    phone: real(row?.phone) || real(local.phone),
  };
}
