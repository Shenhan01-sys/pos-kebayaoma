import { describe, expect, it } from "vitest";
import { resolveBootStore } from "./store-scope";

describe("resolveBootStore", () => {
  it("toko staf (kasir terkunci) selalu menang", () => {
    expect(resolveBootStore("mj", "ml", "ml")).toBe("mj");
  });
  it("akun lintas-toko: kunci perangkat, lalu pilihan terakhir", () => {
    expect(resolveBootStore(null, "mj", "ml")).toBe("mj");
    expect(resolveBootStore(null, null, "ml")).toBe("ml");
  });
  it("tanpa apa-apa → null (Semua toko)", () => {
    expect(resolveBootStore(null, null, null)).toBeNull();
    expect(resolveBootStore(undefined, "", "")).toBeNull();
  });
});
