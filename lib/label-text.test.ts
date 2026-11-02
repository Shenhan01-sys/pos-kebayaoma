import { describe, expect, it } from "vitest";
import { labelColor, labelSize, labelTitle } from "./label-text";

describe("labelTitle", () => {
  it("varian yang memuat nama produk dipakai apa adanya", () => {
    expect(labelTitle("Kebaya", "Kebaya Encim")).toBe("Kebaya Encim");
    expect(labelTitle("Kebaya", "kebaya lawasan")).toBe("kebaya lawasan");
  });

  it("nama produk + nama varian bila belum memuat", () => {
    expect(labelTitle("Kain", "Merah")).toBe("Kain Merah");
  });

  it("nama produk sudah memuat nama varian → nama produk saja", () => {
    expect(labelTitle("Kebaya Encim", "Encim")).toBe("Kebaya Encim");
  });

  it("varian kosong / 'Series N' → nama produk", () => {
    expect(labelTitle("Anting", "")).toBe("Anting");
    expect(labelTitle("Anting", undefined)).toBe("Anting");
    expect(labelTitle("Anting", "Series 1")).toBe("Anting");
    expect(labelTitle("Anting", "series")).toBe("Anting");
  });

  it("spasi di tepi dibuang", () => {
    expect(labelTitle(" Kain ", " Merah ")).toBe("Kain Merah");
  });
});

describe("labelSize", () => {
  it("One Size / kosong disembunyikan", () => {
    expect(labelSize("One Size")).toBe("");
    expect(labelSize("ONE SIZE")).toBe("");
    expect(labelSize("")).toBe("");
    expect(labelSize(null)).toBe("");
    expect(labelSize(undefined)).toBe("");
  });

  it("size nyata dipertahankan", () => {
    expect(labelSize("M")).toBe("M");
    expect(labelSize(" XL ")).toBe("XL");
  });
});

describe("labelColor", () => {
  it("warna yang sama dengan judul dibuang", () => {
    expect(labelColor("Kebaya Encim", "Kebaya Encim")).toBe("");
  });

  it("warna beda tetap tampil", () => {
    expect(labelColor("Merah", "Kebaya Encim")).toBe("Merah");
  });

  it("warna kosong → kosong", () => {
    expect(labelColor(undefined, "Kebaya")).toBe("");
    expect(labelColor("", "Kebaya")).toBe("");
  });
});
