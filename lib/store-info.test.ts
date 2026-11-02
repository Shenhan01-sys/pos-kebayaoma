import { describe, expect, it } from "vitest";
import { resolveReceiptStore } from "./store-info";

const local = { storeName: "Kebaya Oma", address: "Jl. Sudirman No. 123, Jakarta", phone: "021-1234-5678" };
const stores = [
  { id: "mjl", address: " Jl. Pahlawan 10, Majalengka ", phone: "0812-1" },
  { id: "ktb", address: null, phone: "" },
];

describe("resolveReceiptStore", () => {
  it("memakai alamat & telepon toko (DB) bila terisi", () => {
    expect(resolveReceiptStore(local, stores, "mjl")).toEqual({ storeName: "Kebaya Oma", address: "Jl. Pahlawan 10, Majalengka", phone: "0812-1" });
  });
  it("kolom kosong → cadangan lokal per field", () => {
    expect(resolveReceiptStore(local, stores, "ktb")).toEqual(local);
  });
  it("toko tak dikenal / tanpa id → cadangan lokal", () => {
    expect(resolveReceiptStore(local, stores, "zzz")).toEqual(local);
    expect(resolveReceiptStore(local, stores, null)).toEqual(local);
    expect(resolveReceiptStore(local, [], "mjl")).toEqual(local);
  });
});
