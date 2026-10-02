import { describe, expect, it } from "vitest";
import { insertProductWithVariants, type CatalogDb } from "./catalog-insert";

function fakeDb(opts: { failVariants?: boolean; failDelete?: boolean } = {}) {
  const calls: string[] = [];
  const db: CatalogDb = {
    async insertProduct(row) {
      calls.push("insertProduct");
      return { id: "p-1", ...row } as { id: string };
    },
    async insertVariants(rows) {
      calls.push(`insertVariants:${rows.length}`);
      if (opts.failVariants) throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
    },
    async deleteProduct(id) {
      calls.push(`deleteProduct:${id}`);
      if (opts.failDelete) throw new Error("delete gagal");
    },
  };
  return { db, calls };
}

describe("insertProductWithVariants — rollback (tidak ada produk yatim)", () => {
  it("sukses: produk → varian → (afterVariants); tanpa delete", async () => {
    const { db, calls } = fakeDb();
    const seen: string[] = [];
    const id = await insertProductWithVariants(
      db,
      { name: "A" },
      (pid) => [{ product_id: pid }, { product_id: pid }],
      async (pid) => { seen.push(pid); }
    );
    expect(id).toBe("p-1");
    expect(calls).toEqual(["insertProduct", "insertVariants:2"]);
    expect(seen).toEqual(["p-1"]);
  });

  it("varian gagal (409) → produk DIHAPUS lagi & error asli dilempar", async () => {
    const { db, calls } = fakeDb({ failVariants: true });
    await expect(insertProductWithVariants(db, { name: "A" }, () => [{}, {}])).rejects.toMatchObject({ code: "23505" });
    expect(calls).toEqual(["insertProduct", "insertVariants:2", "deleteProduct:p-1"]);
  });

  it("seed stok (afterVariants) gagal → produk dihapus lagi", async () => {
    const { db, calls } = fakeDb();
    await expect(
      insertProductWithVariants(db, { name: "A" }, () => [{}], async () => { throw new Error("seed gagal"); })
    ).rejects.toThrow("seed gagal");
    expect(calls).toEqual(["insertProduct", "insertVariants:1", "deleteProduct:p-1"]);
  });

  it("produk gagal dibuat → tidak ada yang dihapus", async () => {
    const calls: string[] = [];
    const db: CatalogDb = {
      async insertProduct() { calls.push("insertProduct"); throw new Error("gagal produk"); },
      async insertVariants() { calls.push("insertVariants"); },
      async deleteProduct() { calls.push("deleteProduct"); },
    };
    await expect(insertProductWithVariants(db, {}, () => [])).rejects.toThrow("gagal produk");
    expect(calls).toEqual(["insertProduct"]);
  });

  it("rollback sendiri gagal → tetap melaporkan error ASLI (bukan error delete)", async () => {
    const { db } = fakeDb({ failVariants: true, failDelete: true });
    await expect(insertProductWithVariants(db, {}, () => [{}])).rejects.toMatchObject({ code: "23505" });
  });
});
