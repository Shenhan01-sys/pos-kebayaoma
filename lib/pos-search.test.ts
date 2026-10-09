import { describe, expect, it } from "vitest";
import type { Product, Variant } from "./dummy";
import { filterProductsByQuery, findExactVariantMatch, matchesPriceToken } from "./pos-search";

const v = (over: Partial<Variant>): Variant => ({
  id: "vid",
  sku: "11111111",
  name: "",
  size: "M",
  color: "Merah",
  colorCode: "#775533",
  sellingPrice: 100000,
  costPrice: 50000,
  ...over,
});

const p = (over: Partial<Product> & { variants?: Variant[]; id?: string }): Product => ({
  id: over.id ?? "pid",
  sku: "P-001",
  name: "Kebaya",
  description: "",
  categoryId: "cat-kebaya",
  images: [],
  tags: [],
  active: true,
  stock: 5,
  fabric: "",
  care: "",
  variants: over.variants ?? [],
  ...over,
});

const catalog: Product[] = [
  p({
    id: "p1",
    name: "Kebaya",
    variants: [
      v({ id: "v1", sku: "51728304", name: "kebaya 110", sellingPrice: 110000 }),
      v({ id: "v2", sku: "22222222", name: "kebaya 150", sellingPrice: 150000 }),
    ],
  }),
  p({
    id: "p2",
    name: "Selendang Sutra",
    tags: ["selendang", "kuning"],
    variants: [v({ id: "v3", sku: "33333333", name: "", sellingPrice: 15000 })],
  }),
  p({
    id: "p3",
    name: "Batik Tulis",
    variants: [v({ id: "v4", sku: "44444444", name: "parang", size: "XL", color: "Biru", sellingPrice: 250000 })],
  }),
];

describe("E22 matchesPriceToken", () => {
  it("token ribuan: 150 → 150000; token rupiah penuh: 150000 → 150000", () => {
    expect(matchesPriceToken("150", 150000)).toBe(true);
    expect(matchesPriceToken("150000", 150000)).toBe(true);
    expect(matchesPriceToken("150", 15000)).toBe(false);
  });

  it("token 1 digit & non-numerik tidak dipakai untuk harga", () => {
    expect(matchesPriceToken("1", 100000)).toBe(false);
    expect(matchesPriceToken("kebaya", 150000)).toBe(false);
  });
});

describe("E22 filterProductsByQuery", () => {
  it("query kosong → semua lolos (perilaku lama)", () => {
    expect(filterProductsByQuery(catalog, "")).toHaveLength(3);
    expect(filterProductsByQuery(catalog, "   ")).toHaveLength(3);
  });

  it("keluhan Glori: 'kebaya 150' → produk Kebaya (match nama varian)", () => {
    const out = filterProductsByQuery(catalog, "kebaya 150");
    expect(out.map((x) => x.id)).toEqual(["p1"]);
  });

  it("urutan token bebas: '150 kebaya' sama hasilnya", () => {
    expect(filterProductsByQuery(catalog, "150 kebaya").map((x) => x.id)).toEqual(["p1"]);
  });

  it("token AND: 'kebaya 999' tidak lolos (999 gak ada di mana pun)", () => {
    expect(filterProductsByQuery(catalog, "kebaya 999")).toHaveLength(0);
  });

  it("token numerik cocok ke harga varian: 'selendang 15' → Selendang (15.000)", () => {
    expect(filterProductsByQuery(catalog, "selendang 15").map((x) => x.id)).toEqual(["p2"]);
  });

  it("tetap bisa cari SKU varian & barcode & size & warna", () => {
    expect(filterProductsByQuery(catalog, "51728304").map((x) => x.id)).toEqual(["p1"]);
    expect(filterProductsByQuery(catalog, "parang").map((x) => x.id)).toEqual(["p3"]);
    expect(filterProductsByQuery(catalog, "xl").map((x) => x.id)).toEqual(["p3"]);
    expect(filterProductsByQuery(catalog, "biru").map((x) => x.id)).toEqual(["p3"]);
  });

  it("produk tanpa varian tetap bisa dicari via nama", () => {
    expect(filterProductsByQuery(catalog, "tulis").map((x) => x.id)).toEqual(["p3"]);
  });
});

describe("E22 findExactVariantMatch (Enter auto-add)", () => {
  it("SKU varian exact → varian itu", () => {
    const hit = findExactVariantMatch(catalog, "51728304");
    expect(hit?.variant.id).toBe("v1");
  });

  it("nama varian unik ('kebaya 150') → varian itu", () => {
    const hit = findExactVariantMatch(catalog, "kebaya 150");
    expect(hit?.variant.id).toBe("v2");
  });

  it("ambigu ('kebaya' cocok 2 varian) → null, jangan menebak", () => {
    expect(findExactVariantMatch(catalog, "kebaya")).toBeNull();
  });

  it("tak ada yang cocok → null", () => {
    expect(findExactVariantMatch(catalog, "gaada")).toBeNull();
  });
});
