import { describe, expect, it } from "vitest";
import { inclusiveTax } from "./tax";

describe("inclusiveTax (E4 AC)", () => {
  it("rate 0 → tanpa pajak, grand = net", () => {
    expect(inclusiveTax(100000, 0)).toEqual({ grand: 100000, impliedTax: 0 });
  });

  it("rate 11% net 100.000 → grand TETAP 100.000, ppn tersirat 9.910", () => {
    const { grand, impliedTax } = inclusiveTax(100000, 11);
    expect(grand).toBe(100000); // BUKAN 111.000
    // round(100000 - 100000/1.11) = round(9909.9099) = 9910 (AC mengizinkan ±Rp 1 dari 9.909)
    expect(impliedTax).toBe(9910);
  });

  it("selisih grand-net = 0 untuk semua nominal (AC-E4#1)", () => {
    for (const net of [12500, 37500, 99000, 1000000, 1]) {
      expect(inclusiveTax(net, 11).grand).toBe(Math.max(0, Math.round(net)));
    }
  });

  it("ppn tersirat selalu < net dan positif saat rate>0", () => {
    const { impliedTax } = inclusiveTax(100000, 12);
    expect(impliedTax).toBeGreaterThan(0);
    expect(impliedTax).toBeLessThan(100000);
  });

  it("net 0 → 0/0", () => {
    expect(inclusiveTax(0, 11)).toEqual({ grand: 0, impliedTax: 0 });
  });

  it("net negatif → grand clamp 0", () => {
    expect(inclusiveTax(-500, 11).grand).toBe(0);
  });
});
