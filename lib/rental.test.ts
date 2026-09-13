import { describe, expect, it } from "vitest";
import { addDays, daysLeft, rentalStatus, outstandingQty, rentTotal } from "./rental";

const day = (s: string) => new Date(s + "T12:00:00+07:00");

describe("rental (E7)", () => {
  it("addDays default rental_days", () => {
    expect(addDays("2026-09-13", 7)).toBe("2026-09-20");
    expect(addDays("2026-09-28", 3)).toBe("2026-10-01");
  });

  it("status: aktif / jatuh-tempo / lewat / selesai", () => {
    const r = { due_date: "2026-09-20", qty: 3, returned_qty: 0 };
    expect(rentalStatus(r, day("2026-09-15"))).toBe("aktif");
    expect(rentalStatus(r, day("2026-09-20"))).toBe("jatuh-tempo");
    expect(rentalStatus(r, day("2026-09-21"))).toBe("lewat");
    expect(rentalStatus({ ...r, returned_qty: 3 }, day("2026-09-21"))).toBe("selesai");
    expect(rentalStatus({ ...r, returned_qty: 1 }, day("2026-09-15"))).toBe("sebagian");
  });

  it("daysLeft negatif setelah lewat", () => {
    expect(daysLeft("2026-09-20", day("2026-09-18"))).toBe(2);
    expect(daysLeft("2026-09-20", day("2026-09-22"))).toBe(-2);
  });

  it("outstanding & rentTotal", () => {
    expect(outstandingQty({ qty: 3, returned_qty: 1 })).toBe(2);
    expect(outstandingQty({ qty: 3, returned_qty: 3 })).toBe(0);
    expect(rentTotal(150000, 2)).toBe(300000);
    expect(rentTotal(150000.4, 2)).toBe(300001);
  });
});
