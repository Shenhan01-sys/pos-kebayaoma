import { describe, expect, it } from "vitest";
import { outletAddress, resolveReceiptStore } from "./store-info";

const local = { storeName: "Kebaya Oma", address: "Jl. Sudirman No. 123, Jakarta", phone: "021-1234-5678" };
const stores = [
  { id: "mjl", name: "Kebaya Oma - Monjali", address: " Jl. Pahlawan 10, Majalengka ", phone: "0812-1" },
  { id: "ktb", name: "Kebaya Oma - Kota Baru", address: null, phone: "" },
  { id: "mjl-dummy", name: "Kebaya Oma - Monjali", address: "Jl. Sudirman No. 123, Jakarta", phone: "021-1234-5678" },
  { id: "lain", name: "Gudang", address: null, phone: null },
];

describe("resolveReceiptStore", () => {
  it("memakai alamat & telepon toko (DB) bila terisi", () => {
    expect(resolveReceiptStore(local, stores, "mjl")).toEqual({ storeName: "Kebaya Oma", address: "Jl. Pahlawan 10, Majalengka", phone: "0812-1" });
  });
  it("alamat DB kosong → alamat resmi outlet; telepon dummy dibuang", () => {
    expect(resolveReceiptStore(local, stores, "ktb")).toEqual({ storeName: "Kebaya Oma", address: "Cokrodipuran 6, Yogyakarta", phone: "" });
  });
  it("nilai dummy di DB diabaikan → alamat resmi outlet", () => {
    expect(resolveReceiptStore(local, stores, "mjl-dummy").address).toBe("Jalan Monjali 55, Yogyakarta");
  });
  it("outlet tak dikenal → isian lokal yang bukan dummy", () => {
    const own = { ...local, address: "Jl. Mawar 1", phone: "0274-1" };
    expect(resolveReceiptStore(own, stores, "lain")).toEqual(own);
    expect(resolveReceiptStore(local, stores, "lain")).toEqual({ storeName: "Kebaya Oma", address: "", phone: "" });
    expect(resolveReceiptStore(own, [], null)).toEqual(own);
  });
});

describe("outletAddress", () => {
  it("mengenali nama outlet", () => {
    expect(outletAddress("Kebaya Oma - Monjali")).toBe("Jalan Monjali 55, Yogyakarta");
    expect(outletAddress("Kebaya Oma - Kota Baru")).toBe("Cokrodipuran 6, Yogyakarta");
    expect(outletAddress("Kebaya Oma - Cokrodipuran")).toBe("Cokrodipuran 6, Yogyakarta");
    expect(outletAddress("Kebaya Oma - Malioboro")).toBe("Cokrodipuran 6, Yogyakarta");
    expect(outletAddress(null)).toBe("");
  });
});
