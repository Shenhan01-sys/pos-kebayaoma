// lib/catalog-insert.ts — E16: simpan produk + varian dengan ROLLBACK.
// Sebelumnya produk di-insert dulu lalu varian; kalau varian gagal (409 SKU kembar) produk
// tertinggal tanpa varian (yatim). Sekarang kegagalan di langkah mana pun setelah produk dibuat
// menghapus produk itu lagi (varian ikut terhapus lewat ON DELETE CASCADE).

export interface CatalogDb {
  insertProduct(row: Record<string, unknown>): Promise<{ id: string }>;
  insertVariants(rows: Record<string, unknown>[]): Promise<void>;
  deleteProduct(id: string): Promise<void>;
}

export async function insertProductWithVariants(
  db: CatalogDb,
  productRow: Record<string, unknown>,
  makeVariantRows: (productId: string) => Record<string, unknown>[],
  afterVariants?: (productId: string) => Promise<void>
): Promise<string> {
  const { id } = await db.insertProduct(productRow);
  try {
    await db.insertVariants(makeVariantRows(id));
    if (afterVariants) await afterVariants(id);
    return id;
  } catch (error) {
    try {
      await db.deleteProduct(id);
    } catch {
      /* rollback gagal: error asli tetap yang dilaporkan */
    }
    throw error;
  }
}
