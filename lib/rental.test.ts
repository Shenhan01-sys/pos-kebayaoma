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

// ===== E17: halaman /sewa =====
import {
  depositTotal,
  filterRentals,
  isOpenRental,
  matchesQuery,
  normalizePhoneId,
  reminderText,
  rentalSummary,
  sortRentals,
  statusOf,
  waLink,
  type RentalItem,
} from "./rental";

const NOW = new Date(2026, 9, 10, 9, 0, 0); // 10 Okt 2026 (lokal)
const mk = (o: Partial<RentalItem> & { id: string }): RentalItem => ({
  txNumber: "MJL-0001",
  productName: "Kebaya Brokat",
  customerName: "Sari",
  customerPhone: "081234567890",
  qty: 1,
  returnedQty: 0,
  rentPrice: 100000,
  deposit: 50000,
  startDate: "2026-10-07",
  dueDate: "2026-10-12",
  ...o,
});

const data: RentalItem[] = [
  mk({ id: "a", dueDate: "2026-10-14", customerName: "Ani", txNumber: "MJL-0010" }), // aktif (4 hari)
  mk({ id: "b", dueDate: "2026-10-10", customerName: "Budi", txNumber: "MJL-0011", productName: "Selendang" }), // hari ini
  mk({ id: "c", dueDate: "2026-10-07", customerName: "Citra", txNumber: "KTB-0003", qty: 3, returnedQty: 1, deposit: 20000 }), // terlambat 3 hari, sebagian
  mk({ id: "d", dueDate: "2026-10-01", customerName: "Dewi", qty: 2, returnedQty: 2 }), // selesai
  mk({ id: "e", dueDate: "2026-10-09", customerName: "Eka", customerPhone: null, deposit: null }), // terlambat 1 hari
];

describe("E17 status & tab", () => {
  it("isOpenRental", () => {
    expect(isOpenRental({ qty: 2, returnedQty: 1 })).toBe(true);
    expect(isOpenRental({ qty: 2, returnedQty: 2 })).toBe(false);
  });
  it("statusOf mengikuti rentalStatus", () => {
    expect(statusOf(data[0], NOW)).toBe("aktif");
    expect(statusOf(data[1], NOW)).toBe("jatuh-tempo");
    expect(statusOf(data[2], NOW)).toBe("sebagian");
    expect(statusOf(data[3], NOW)).toBe("selesai");
    expect(statusOf(data[4], NOW)).toBe("lewat");
  });
  it("tab aktif = semua yang belum kembali penuh", () => {
    expect(filterRentals(data, { tab: "aktif", query: "" }, NOW).map((r) => r.id)).toEqual(["c", "e", "b", "a"]);
  });
  it("tab terlambat hanya yang lewat jatuh tempo & belum selesai; paling lama di atas", () => {
    expect(filterRentals(data, { tab: "terlambat", query: "" }, NOW).map((r) => r.id)).toEqual(["c", "e"]);
  });
  it("tab hari-ini", () => {
    expect(filterRentals(data, { tab: "hari-ini", query: "" }, NOW).map((r) => r.id)).toEqual(["b"]);
  });
  it("tab selesai hanya yang kembali penuh", () => {
    expect(filterRentals(data, { tab: "selesai", query: "" }, NOW).map((r) => r.id)).toEqual(["d"]);
  });
});

describe("E17 pencarian", () => {
  it("nama penyewa, produk, nomor nota (tak peka huruf besar)", () => {
    expect(matchesQuery(data[0], "ANI")).toBe(true);
    expect(matchesQuery(data[1], "selendang")).toBe(true);
    expect(matchesQuery(data[2], "ktb-0003")).toBe(true);
    expect(matchesQuery(data[0], "xyz")).toBe(false);
  });
  it("nomor HP dicari lewat digit (abaikan spasi/strip), min 3 digit", () => {
    expect(matchesQuery(data[0], "0812-3456")).toBe(true);
    expect(matchesQuery(data[0], "08 12")).toBe(true);
    expect(matchesQuery(data[4], "0812")).toBe(false); // tanpa HP
    expect(matchesQuery(data[0], "99")).toBe(false); // < 3 digit tidak dianggap HP
  });
  it("query kosong = lolos; digabung dengan tab", () => {
    expect(matchesQuery(data[0], "   ")).toBe(true);
    expect(filterRentals(data, { tab: "terlambat", query: "eka" }, NOW).map((r) => r.id)).toEqual(["e"]);
  });
});

describe("E17 urutan", () => {
  it("terbuka: jatuh tempo paling awal dulu; selesai: terbaru dulu; tidak mengubah array asal", () => {
    const before = data.map((r) => r.id).join();
    expect(sortRentals(data, "aktif").map((r) => r.id)).toEqual(["d", "c", "e", "b", "a"]);
    expect(sortRentals(data, "selesai").map((r) => r.id)).toEqual(["a", "b", "e", "c", "d"]);
    expect(data.map((r) => r.id).join()).toBe(before);
  });
});

describe("E17 ringkasan", () => {
  it("hitung open/overdue/dueToday/unit keluar/deposit ditahan", () => {
    const s = rentalSummary(data, NOW);
    expect(s.open).toBe(4); // a b c e (d selesai)
    expect(s.overdue).toBe(2); // c e
    expect(s.dueToday).toBe(1); // b
    expect(s.unitsOut).toBe(1 + 1 + 2 + 1); // a1 b1 c(3-1)=2 e1
    // deposit per unit × sisa unit: a 50k + b 50k + c 20k×2 + e 0
    expect(s.depositHeld).toBe(50000 + 50000 + 40000 + 0);
  });
  it("daftar kosong", () => {
    expect(rentalSummary([], NOW)).toEqual({ open: 0, overdue: 0, dueToday: 0, unitsOut: 0, depositHeld: 0 });
  });
  it("depositTotal = deposit per unit × qty", () => {
    expect(depositTotal({ deposit: 20000, qty: 3 })).toBe(60000);
    expect(depositTotal({ deposit: null, qty: 3 })).toBe(0);
  });
});

describe("E17 WhatsApp", () => {
  it("normalizePhoneId: 08xx, +62, 62, 8xx, spasi/strip", () => {
    expect(normalizePhoneId("081234567890")).toBe("6281234567890");
    expect(normalizePhoneId("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizePhoneId("6281234567890")).toBe("6281234567890");
    expect(normalizePhoneId("81234567890")).toBe("6281234567890");
  });
  it("normalizePhoneId: kosong / bukan nomor ID / terlalu pendek → null", () => {
    expect(normalizePhoneId("")).toBeNull();
    expect(normalizePhoneId(null)).toBeNull();
    expect(normalizePhoneId("abc")).toBeNull();
    expect(normalizePhoneId("+1 415 555 0100")).toBeNull();
    expect(normalizePhoneId("0812")).toBeNull();
  });
  it("waLink: URL wa.me dengan teks ter-encode; tanpa HP → null", () => {
    const link = waLink("0812-3456-7890", "Halo & terima kasih");
    expect(link).toBe("https://wa.me/6281234567890?text=Halo%20%26%20terima%20kasih");
    expect(waLink(null, "x")).toBeNull();
  });
  it("reminderText: terlambat / hari ini / akan datang, menyebut sisa unit & nota", () => {
    expect(reminderText(data[2], NOW)).toContain("lewat 3 hari");
    expect(reminderText(data[2], NOW)).toContain("×2"); // sisa 2 dari 3
    expect(reminderText(data[2], NOW)).toContain("KTB-0003");
    expect(reminderText(data[1], NOW)).toContain("HARI INI");
    expect(reminderText(data[0], NOW)).toContain("4 hari lagi");
    expect(reminderText(mk({ id: "z", customerName: null, dueDate: "2026-10-20" }), NOW)).toContain("Halo Kak");
  });
});

// ===== E17 revisi 1: persen harga sewa =====
import { RENTAL_PCT_OPTIONS, matchingRentalPct, rentalPriceFromPct } from "./rental";

describe("E17 persen harga sewa", () => {
  it("pilihan = 50, 60, 70, 80, 90 persen", () => {
    expect([...RENTAL_PCT_OPTIONS]).toEqual([50, 60, 70, 80, 90]);
  });
  it("persen × harga jual (harga bulat tetap bulat)", () => {
    expect(rentalPriceFromPct(150000, 50)).toBe(75000);
    expect(rentalPriceFromPct(150000, 60)).toBe(90000);
    expect(rentalPriceFromPct(150000, 70)).toBe(105000);
    expect(rentalPriceFromPct(150000, 80)).toBe(120000);
    expect(rentalPriceFromPct(150000, 90)).toBe(135000);
  });
  it("dibulatkan ke Rp 500 terdekat; minimal Rp 500", () => {
    expect(rentalPriceFromPct(175000, 70)).toBe(122500); // 122.500 persis
    expect(rentalPriceFromPct(133000, 70)).toBe(93000); // 93.100 → 93.000
    expect(rentalPriceFromPct(133500, 70)).toBe(93500); // 93.450 → 93.500
    expect(rentalPriceFromPct(100, 50)).toBe(500);
  });
  it("harga jual belum diisi / negatif / persen tak valid → null", () => {
    expect(rentalPriceFromPct(0, 50)).toBeNull();
    expect(rentalPriceFromPct(-1000, 50)).toBeNull();
    expect(rentalPriceFromPct(NaN, 50)).toBeNull();
    expect(rentalPriceFromPct(100000, 0)).toBeNull();
  });
  it("hasil selalu < harga jual untuk persen < 100 dan naik mengikuti persen", () => {
    const prices = RENTAL_PCT_OPTIONS.map((p) => rentalPriceFromPct(260000, p)!);
    expect(prices.every((x) => x < 260000)).toBe(true);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
  it("matchingRentalPct menyorot persen yang cocok; harga manual → null", () => {
    expect(matchingRentalPct(150000, 105000)).toBe(70);
    expect(matchingRentalPct(150000, 75000)).toBe(50);
    expect(matchingRentalPct(150000, 100000)).toBeNull(); // diisi manual
    expect(matchingRentalPct(150000, null)).toBeNull();
    expect(matchingRentalPct(150000, 0)).toBeNull();
  });
});

// ===== E17 revisi 2: default harga sewa =====
import { DEFAULT_RENTAL_PCT, resolveRentalPrice } from "./rental";

describe("E17 default harga sewa", () => {
  it("default = salah satu pilihan persen (70%)", () => {
    expect(DEFAULT_RENTAL_PCT).toBe(70);
    expect([...RENTAL_PCT_OPTIONS]).toContain(DEFAULT_RENTAL_PCT);
  });
  it("harga sewa varian sudah diatur → dipakai apa adanya (bukan default)", () => {
    expect(resolveRentalPrice(150000, 90000)).toEqual({ price: 90000, isDefault: false });
  });
  it("belum diatur (null/undefined/0) → 70% × harga jual, ditandai default", () => {
    expect(resolveRentalPrice(150000, null)).toEqual({ price: 105000, isDefault: true });
    expect(resolveRentalPrice(150000, undefined)).toEqual({ price: 105000, isDefault: true });
    expect(resolveRentalPrice(150000, 0)).toEqual({ price: 105000, isDefault: true });
  });
  it("persen bisa diganti", () => {
    expect(resolveRentalPrice(100000, null, 50)).toEqual({ price: 50000, isDefault: true });
  });
  it("harga jual belum diisi & harga sewa kosong → price null (tak bisa disewa)", () => {
    expect(resolveRentalPrice(0, null)).toEqual({ price: null, isDefault: true });
  });
  it("harga sewa sudah diatur tetap dipakai walau harga jual 0", () => {
    expect(resolveRentalPrice(0, 50000)).toEqual({ price: 50000, isDefault: false });
  });
});

// ===== E18: draft sewa → keranjang POS → checkout =====
import { buildRentalDraft, rentalDraftDeposit, rentalDraftTotal, toRentalSpec, validateRentalDraft } from "./rental";

const base = {
  productId: "p1",
  variantId: "v1",
  qty: 2,
  rentPrice: 75000,
  deposit: 20000,
  days: 5,
  startDate: "2026-10-02",
  customerName: "  Sari  ",
  customerPhone: " 0857-1111-2222 ",
};

describe("E18 draft sewa", () => {
  it("jatuh tempo = mulai + hari; nama & HP dirapikan; deposit per unit dipertahankan", () => {
    const d = buildRentalDraft(base);
    expect(d.dueDate).toBe("2026-10-07");
    expect(d.customerName).toBe("Sari");
    expect(d.customerPhone).toBe("0857-1111-2222");
    expect(d.deposit).toBe(20000);
    expect(d.days).toBe(5);
  });
  it("HP kosong/spasi → null; deposit 0/null → null", () => {
    expect(buildRentalDraft({ ...base, customerPhone: "   " }).customerPhone).toBeNull();
    expect(buildRentalDraft({ ...base, deposit: 0 }).deposit).toBeNull();
    expect(buildRentalDraft({ ...base, deposit: null }).deposit).toBeNull();
  });
  it("qty/hari minimal 1, desimal dibulatkan, harga ke rupiah utuh", () => {
    const d = buildRentalDraft({ ...base, qty: 0, days: 0.2, rentPrice: 75000.6 });
    expect(d.qty).toBe(1);
    expect(d.days).toBe(1);
    expect(d.rentPrice).toBe(75001);
    expect(d.dueDate).toBe("2026-10-03");
  });
  it("tagihan = tarif × qty; deposit total = deposit/unit × qty (terpisah dari tagihan)", () => {
    const d = buildRentalDraft(base);
    expect(rentalDraftTotal(d)).toBe(150000);
    expect(rentalDraftDeposit(d)).toBe(40000);
    expect(rentalDraftDeposit(buildRentalDraft({ ...base, deposit: null }))).toBe(0);
  });
  it("toRentalSpec: hanya kolom yang disisipkan ke rentals", () => {
    expect(toRentalSpec(buildRentalDraft(base))).toEqual({
      productId: "p1",
      qty: 2,
      rentPrice: 75000,
      deposit: 20000,
      startDate: "2026-10-02",
      dueDate: "2026-10-07",
      customerPhone: "0857-1111-2222",
    });
  });
});

describe("E18 validateRentalDraft", () => {
  const ok = buildRentalDraft(base);
  it("draft layak → null", () => {
    expect(validateRentalDraft(ok, 10)).toBeNull();
    expect(validateRentalDraft(ok, 2)).toBeNull(); // stok pas
  });
  it("nama kosong", () => {
    expect(validateRentalDraft({ ...ok, customerName: "  " }, 10)).toMatch(/penyewa/i);
  });
  it("harga 0 / negatif", () => {
    expect(validateRentalDraft({ ...ok, rentPrice: 0 }, 10)).toMatch(/harga sewa/i);
    expect(validateRentalDraft({ ...ok, rentPrice: -5 }, 10)).toMatch(/harga sewa/i);
  });
  it("stok kurang → menyebut stok", () => {
    expect(validateRentalDraft({ ...ok, qty: 3 }, 2)).toBe("Stok hanya 2.");
  });
  it("hari < 1, qty < 1, tanggal mulai rusak", () => {
    expect(validateRentalDraft({ ...ok, days: 0 }, 10)).toMatch(/lama sewa/i);
    expect(validateRentalDraft({ ...ok, qty: 0 }, 10)).toMatch(/jumlah/i);
    expect(validateRentalDraft({ ...ok, startDate: "02-10-2026" }, 10)).toMatch(/tanggal/i);
  });
});
