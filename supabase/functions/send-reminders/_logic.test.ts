import { describe, expect, it } from "vitest";
import { poStage, rentalStage, normalizePhone, dayProgress } from "./_logic.ts";

const day = (s: string) => new Date(s + "T12:00:00+07:00");

describe("poStage (AC-E6#4)", () => {
  it("due 5 hari (basis kalender): <50% → null; ≥50% (hari-4) → '50'; setelah 50% terkirim → '20'", () => {
    const created = "2026-09-01T08:00:00+07:00";
    expect(poStage({ created_at: created, due_date: "2026-09-06" }, day("2026-09-02"))).toBeNull(); // 20%
    expect(poStage({ created_at: created, due_date: "2026-09-06" }, day("2026-09-03"))).toBeNull(); // 40%
    expect(poStage({ created_at: created, due_date: "2026-09-06" }, day("2026-09-04"))).toBe("50"); // 60%
    expect(poStage({ created_at: created, due_date: "2026-09-06", reminded_at_50: "x" }, day("2026-09-05"))).toBe("20"); // 80%
  });
  it("catch-up: lewati 50% langsung 80% → 50 dulu (urutan pesan), baru 20 ronde berikut", () => {
    const created = "2026-09-01T08:00:00+07:00";
    expect(poStage({ created_at: created, due_date: "2026-09-06" }, day("2026-09-05"))).toBe("50");
  });
  it("yang ditandai tidak diulang (0 reminder dobel)", () => {
    const created = "2026-09-01T08:00:00+07:00";
    expect(poStage({ created_at: created, due_date: "2026-09-06", reminded_at_50: "x", reminded_at_20: "y" }, day("2026-09-05"))).toBeNull();
    expect(poStage({ created_at: created, due_date: "2026-09-06", reminded_at_50: "x" }, day("2026-09-05"))).toBe("20");
  });
  it("dayProgress 5 hari: hari-3 = elapsed 2", () => {
    const p = dayProgress("2026-09-01T08:00:00+07:00", "2026-09-06", day("2026-09-03"));
    expect(p.total).toBe(5);
    expect(p.elapsed).toBe(2);
  });
});

describe("rentalStage (AC-E7#3)", () => {
  it("sewa 7 hari mulai 1: H-20% = sisa ≤2 hari → '20'", () => {
    const r = { start_date: "2026-09-01", due_date: "2026-09-08", qty: 2, returned_qty: 0 };
    expect(rentalStage(r, day("2026-09-07"))).toBe("20"); // sisa 1 hari ≤ ceil(7*0.2)=2
    expect(rentalStage(r, day("2026-09-05"))).toBeNull(); // sisa 3 > 2
  });
  it("hari-H → '0'; lewat → 'overdue' sekali/hari", () => {
    const r = { start_date: "2026-09-01", due_date: "2026-09-08", qty: 2, returned_qty: 0 };
    expect(rentalStage(r, day("2026-09-08"))).toBe("0");
    expect(rentalStage({ ...r, reminded_at_20: "x" }, day("2026-09-08"))).toBe("0");
    expect(rentalStage({ ...r, reminded_at_0: "x" }, day("2026-09-08"))).toBeNull();
    const od = { ...r, overdue_reminded_at: null as string | null };
    expect(rentalStage(od, day("2026-09-10"))).toBe("overdue");
    od.overdue_reminded_at = "2026-09-10T09:00:00+07:00";
    expect(rentalStage(od, day("2026-09-10"))).toBeNull(); // spam >1/hari = 0
    od.overdue_reminded_at = "2026-09-09T09:00:00+07:00";
    expect(rentalStage(od, day("2026-09-10"))).toBe("overdue"); // hari berikutnya boleh lagi
  });
  it("lunas sebagian penuh (returned==qty) → null", () => {
    expect(rentalStage({ start_date: "2026-09-01", due_date: "2026-09-08", qty: 2, returned_qty: 2 }, day("2026-09-10"))).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("08xxx → 628xxx; 62 tetap; symbol dibuang", () => {
    expect(normalizePhone("0812-3456")).toBe("628123456");
    expect(normalizePhone("+62 812 3456")).toBe("628123456");
    expect(normalizePhone("628123456")).toBe("628123456");
  });
});
