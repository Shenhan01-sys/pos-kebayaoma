import { describe, expect, it } from "vitest";
import { CART_TTL_MS, restoreCart } from "./cart-restore";

const now = 1_800_000_000_000;
const saved = { lines: [{ key: "v1", quantity: 2 }], customerName: "Sari", discount: 5000, rental: null, savedAt: now - 60_000 };

describe("restoreCart", () => {
  it("keranjang baru dipulihkan utuh", () => {
    expect(restoreCart(saved, now)).toEqual({ lines: saved.lines, customerName: "Sari", discount: 5000, rental: null });
  });
  it("basi (> TTL), tanpa savedAt, atau rusak → tidak dipulihkan", () => {
    expect(restoreCart({ ...saved, savedAt: now - CART_TTL_MS - 1 }, now)).toBeNull();
    expect(restoreCart({ ...saved, savedAt: undefined }, now)).toBeNull();
    expect(restoreCart({ ...saved, lines: "x" as never }, now)).toBeNull();
    expect(restoreCart(null, now)).toBeNull();
  });
  it("diskon tidak valid jadi 0, draft sewa ikut", () => {
    const r = restoreCart({ ...saved, discount: -3, rental: { days: 3 } }, now);
    expect(r?.discount).toBe(0);
    expect(r?.rental).toEqual({ days: 3 });
  });
});
