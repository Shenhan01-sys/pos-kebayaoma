import { describe, expect, it } from "vitest";
import {
  BITMAP_INK_BIT,
  buildTsplJob as buildRaw,
  code128Bitmap,
  code128BitmapAdaptive,
  XP_BARCODE_MODE,
  code128Pattern,
  BARCODE_FIXED_W,
  code128Modules,
  fitText,
  tsplSafe,
  XP_COLS,
  type TextRenderer,
} from "./tspl";

/** uji lama: barcode native (lebar alami) — mode tetap dites terpisah di bawah */
const buildTsplJob = (l: Parameters<typeof buildRaw>[0], r: TextRenderer, o: Parameters<typeof buildRaw>[2] = {}) =>
  buildRaw(l, r, { barcodeMode: "native", ...o });

// renderer palsu deterministik: lebar = 0,55 * px per karakter, semua piksel = tinta
const fake: TextRenderer = (text, px) => {
  const w = Math.max(1, Math.round(text.length * px * 0.55));
  const h = Math.ceil(px * 1.25);
  return { w, h, ink: new Uint8Array(w * h).fill(1) };
};

const mk = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Anting ${i}`,
    size: "One Size",
    price: 150000,
    barcode: `ANTING-ANTING-${i}`,
  }));

interface Cmd { cmd: string; line: string; x?: number; y?: number; w?: number; h?: number; wb?: number }

/** parse job byte → daftar perintah (BITMAP: lewati data biner sesuai panjangnya) */
function parse(job: Uint8Array): Cmd[] {
  const buf = Buffer.from(job);
  const out: Cmd[] = [];
  let i = 0;
  while (i < buf.length) {
    let e = i;
    while (e < buf.length && buf[e] !== 0x0a) e++;
    const head = buf.subarray(i, Math.min(e, i + 120)).toString("latin1").replace(/\r$/, "");
    const cmd = head.split(/\s/)[0];
    if (cmd === "BITMAP") {
      const m = /^BITMAP (\d+),(\d+),(\d+),(\d+),(\d+),/.exec(head)!;
      const wb = Number(m[3]);
      const h = Number(m[4]);
      out.push({ cmd, line: m[0], x: Number(m[1]), y: Number(m[2]), wb, h, w: wb * 8 });
      i += m[0].length + wb * h;
      if (buf[i] === 0x0d) i++;
      if (buf[i] === 0x0a) i++;
    } else {
      const m = /^(?:BARCODE|TEXT) (\d+),(\d+),/.exec(head);
      out.push({ cmd, line: head, x: m ? Number(m[1]) : undefined, y: m ? Number(m[2]) : undefined });
      i = e + 1;
    }
  }
  return out;
}
const count = (c: Cmd[], name: string) => c.filter((x) => x.cmd === name).length;

describe("buildTsplJob — jumlah baris tepat (tanpa label kosong)", () => {
  it("6 label = 2 baris = 2 PRINT, 6 barcode, 12 bitmap (nama+harga)", () => {
    const c = parse(buildTsplJob(mk(6), fake));
    expect(count(c, "PRINT")).toBe(2);
    expect(count(c, "BARCODE")).toBe(6);
    expect(count(c, "BITMAP")).toBe(12);
  });
  it("7 label = 3 baris, baris terakhir hanya 1 label", () => {
    const c = parse(buildTsplJob(mk(7), fake));
    expect(count(c, "PRINT")).toBe(3);
    expect(count(c, "BARCODE")).toBe(7);
  });
  it("1 label = 1 baris; 0 label = tidak ada PRINT", () => {
    expect(count(parse(buildTsplJob(mk(1), fake)), "PRINT")).toBe(1);
    expect(count(parse(buildTsplJob([], fake)), "PRINT")).toBe(0);
  });
  it("ukuran unit = satu baris 108x15, gap 3", () => {
    const head = Buffer.from(buildTsplJob(mk(3), fake)).toString("latin1");
    expect(head.startsWith("SIZE 108 mm,15 mm\r\nGAP 3 mm,0 mm\r\n")).toBe(true);
  });
  it("tanpa karakter berbahaya: kutip dibuang dari konten barcode", () => {
    const c = parse(buildTsplJob([{ name: 'Kebáya “Ibu” · Ô', size: "L", price: 89000, barcode: 'A"B' }], fake));
    expect(c.find((x) => x.cmd === "BARCODE")!.line).toContain('"AB"');
  });
});

describe("posisi — tiap objek di-center sendiri terhadap sel 33 mm (264 dot)", () => {
  const cells = [8, 298, 588];
  const job = (labels: Parameters<typeof buildTsplJob>[0], o = {}) => parse(buildTsplJob(labels, fake, { topOffsetMm: 0, ...o }));

  it("pitch kolom 290 dot (36,25 mm hasil ukur)", () => {
    const x = job(mk(3), { leftOffsetMm: 0 }).filter((c) => c.cmd === "BARCODE");
    // barcode dengan kode sama panjang → selisih x = pitch
    const same = job(Array.from({ length: 3 }, () => ({ name: "a", price: 1, barcode: "ANTING-ANTING" })), { leftOffsetMm: 0 }).filter((c) => c.cmd === "BARCODE");
    expect(same[1].x! - same[0].x!).toBe(290);
    expect(same[2].x! - same[1].x!).toBe(290);
    expect(x.length).toBe(3);
  });
  it("leftOffsetMm menggeser kanan 8 dot per mm", () => {
    const a = job(mk(1), { leftOffsetMm: 0 }).find((c) => c.cmd === "BARCODE")!.x!;
    const b = job(mk(1), { leftOffsetMm: 3 }).find((c) => c.cmd === "BARCODE")!.x!;
    expect(b - a).toBe(24);
  });
  it("barcode, nama, dan harga masing-masing di-center (kiri == kanan margin)", () => {
    const labels = [{ name: "Anting", size: "One Size", price: 150000, barcode: "ANTING-ANTING" }];
    const c = job(labels);
    const bar = c.find((x) => x.cmd === "BARCODE")!;
    const mod = code128Modules("ANTING-ANTING");
    expect(bar.x! - cells[0]).toBe(Math.floor((264 - mod) / 2));
    for (const bm of c.filter((x) => x.cmd === "BITMAP")) {
      // w kelipatan 8 (padding) → pusatkan terhadap lebar ink: margin kiri ≈ margin kanan (±8 dot padding)
      const left = bm.x! - cells[0];
      const right = cells[0] + 264 - (bm.x! + bm.w!);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(8);
    }
  });
  it("semua isi tiap kolom di dalam sel 33 mm dengan margin aman", () => {
    const c = job([
      { name: "Kebaya Brokat Premium Panjang Sekali Lagi Dan Lagi", size: "One Size", price: 1250000, barcode: "BAGCHRAM-BAGCHRAM" },
      { name: "Anting", size: "L", price: 150000, barcode: "ANTING-ANTING" },
      { name: "Tas", price: 9000, barcode: "BANDANA" },
    ]);
    let col = -1;
    for (const cmd of c) {
      if (cmd.cmd === "BARCODE") {
        col++;
        const m = /,"128",\d+,0,0,1,1,"([^"]*)"/.exec(cmd.line)![1];
        expect(cmd.x!).toBeGreaterThanOrEqual(cells[col]);
        expect(cmd.x! + code128Modules(m)).toBeLessThanOrEqual(cells[col] + 264);
      }
      if (cmd.cmd === "BITMAP") {
        expect(cmd.x!).toBeGreaterThanOrEqual(cells[col] + 12 - 8);
        expect(cmd.x! + cmd.w!).toBeLessThanOrEqual(cells[col] + 264 - 12 + 8);
      }
    }
  });
  it("tinggi blok isi ≤ 12 mm & offset atas default 1,5 mm (12 dot)", () => {
    const y0 = (o: object) => Math.min(...parse(buildTsplJob(mk(1), fake, o)).filter((c) => c.y !== undefined).map((c) => c.y!));
    expect(y0({}) - y0({ topOffsetMm: 0 })).toBe(12);
    const ys = parse(buildTsplJob(mk(1), fake, { topOffsetMm: 0 }));
    const bottom = Math.max(...ys.filter((c) => c.cmd === "BITMAP").map((c) => c.y! + c.h!));
    expect(bottom - Math.min(...ys.filter((c) => c.y !== undefined).map((c) => c.y!))).toBeLessThanOrEqual(104);
  });
});

describe("fitText — nama panjang dipotong, tidak pernah keluar label", () => {
  it("muat → tidak dipotong, ukuran asli", () => {
    const b = fitText(fake, "Anting", "One Size", 240, { max: 13, min: 10 }, false);
    expect(b.w).toBeLessThanOrEqual(240);
  });
  it("kepanjangan → font mengecil lalu dipotong dengan '..', ukuran (suffix) tetap ada", () => {
    const seen: string[] = [];
    const spy: TextRenderer = (t, px, bold) => { seen.push(t); return fake(t, px, bold); };
    const b = fitText(spy, "Kebaya Brokat Premium Panjang Sekali Lagi Dan Lagi", "XL", 240, { max: 13, min: 10 }, false);
    expect(b.w).toBeLessThanOrEqual(240);
    const last = seen[seen.length - 1];
    expect(last.endsWith(" XL")).toBe(true);
    expect(last.includes("..")).toBe(true);
  });
});

describe("BITMAP data", () => {
  it("bit 0 = hitam: piksel ink → bit 0, padding → bit 1", () => {
    const one: TextRenderer = () => ({ w: 3, h: 1, ink: new Uint8Array([1, 0, 1]) });
    const buf = Buffer.from(buildTsplJob([{ name: "x", price: 1, barcode: "A" }], one, { topOffsetMm: 0 }));
    const s = buf.toString("latin1");
    const at = s.indexOf("BITMAP");
    const comma5 = s.indexOf(",0,", at) + 3; // setelah "mode,"
    const byte = buf[comma5];
    // 3 piksel: ink,putih,ink → bit 0,1,0 + padding 11111 → 01011111 = 0x5f
    expect(BITMAP_INK_BIT).toBe(0);
    expect(byte).toBe(0x5f);
  });
});

describe("barcode lebar seragam (fixedBarcode)", () => {
  const codes = ["BANDANA", "ANTING-ANTING", "BAGCHRAM-BAGCHRAM", "8991234567890"];
  it("bitmap selebar tetap utk semua panjang kode, tinggi 40 dot", () => {
    for (const c of codes) {
      const b = code128Bitmap(c, BARCODE_FIXED_W, 40)!;
      expect(b.w).toBe(BARCODE_FIXED_W);
      expect(b.h).toBe(40);
    }
  });
  it("galat posisi tepi modul ≤ 0,5 dot (pembulatan kumulatif) & awal-akhir bar menempel tepi", () => {
    for (const c of codes) {
      const bits = code128Pattern(c);
      const b = code128Bitmap(c, BARCODE_FIXED_W, 1)!;
      // rekonstruksi tepi dari bitmap: tiap transisi harus dekat i*W/n
      const n = bits.length;
      const ideal: number[] = [];
      for (let i = 1; i < n; i++) if (bits[i] !== bits[i - 1]) ideal.push((i * BARCODE_FIXED_W) / n);
      const real: number[] = [];
      for (let x = 1; x < b.w; x++) if (b.ink[x] !== b.ink[x - 1]) real.push(x);
      expect(real.length).toBe(ideal.length);
      real.forEach((x, k) => expect(Math.abs(x - ideal[k])).toBeLessThanOrEqual(0.5 + 1e-9));
      expect(b.ink[0]).toBe(1); // Code128 selalu diawali bar
      expect(b.ink[b.w - 1]).toBe(1); // dan diakhiri bar
    }
  });
  it("kode terlalu panjang (> lebar) → null (jatuh ke barcode native)", () => {
    expect(code128Bitmap("KEBAYA-BROKAT-PREMIUM-EDISI-KHUSUS", BARCODE_FIXED_W, 40)).toBeNull();
  });
  it("job mode fixed: tidak ada perintah BARCODE, semua barcode = BITMAP selebar 30 byte", () => {
    const c = parse(buildRaw(mk(3), fake, { barcodeMode: "fixed" }));
    expect(count(c, "BARCODE")).toBe(0);
    expect(c.filter((x) => x.cmd === "BITMAP" && x.wb === 30 && x.h === 40).length).toBe(3);
  });
  it("barcode fixed di-center di sel 33 mm: margin kiri == kanan", () => {
    const c = parse(buildRaw(mk(1), fake, { barcodeMode: "fixed", topOffsetMm: 0 }));
    const bm = c.find((x) => x.cmd === "BITMAP" && x.h === 40)!;
    expect(bm.x! - 8).toBe(264 - (bm.x! - 8) - 240);
  });
});

describe("barcode adaptive (default) — modul bulat, tanpa distorsi", () => {
  const widthDots = (c: string) => code128Pattern(c).length;
  it("default = adaptive (bukan fixed/pecahan)", () => {
    expect(XP_BARCODE_MODE).toBe("adaptive");
  });
  it("modul = bilangan bulat terbesar (maks 3) yang muat SAFE_W 240 dot", () => {
    const cases: [string, number][] = [
      ["ABCD", 3],              // 79 modul → 3 dot = 237
      ["ANTING", 2],            // ±101 modul → 2 dot
      ["BANDANA", 2],           // 112 modul → 2 dot = 224
      ["ANTING-ANTING", 1],     // 178 → 1 dot
      ["BAGCHRAM-BAGCHRAM", 1], // 222 → 1 dot
    ];
    for (const [code, scale] of cases) {
      const b = code128BitmapAdaptive(code, 40)!;
      expect(b.w).toBe(widthDots(code) * scale);
      expect(b.w).toBeLessThanOrEqual(240);
    }
  });
  it("lebar bar = kelipatan bulat modul (tanpa pecahan): semua run ink/putih kelipatan scale", () => {
    for (const code of ["BANDANA", "ANTING-ANTING", "ABCD"]) {
      const b = code128BitmapAdaptive(code, 1)!;
      const scale = b.w / widthDots(code);
      let run = 1;
      for (let x = 1; x <= b.w; x++) {
        if (x < b.w && b.ink[x] === b.ink[x - 1]) run++;
        else { expect(run % scale).toBe(0); run = 1; }
      }
    }
  });
  it("kode > sel 33 mm (>264 modul) → null (jatuh ke BARCODE native)", () => {
    expect(code128BitmapAdaptive("KEBAYA-BROKAT-PREMIUM-EDISI-KHUSUS", 40)).toBeNull();
  });
  it("job default: tanpa perintah BARCODE; barcode = BITMAP; di-center di sel", () => {
    const c = parse(buildRaw(mk(1), fake, { topOffsetMm: 0 }));
    expect(count(c, "BARCODE")).toBe(0);
    const bm = c.find((x) => x.cmd === "BITMAP" && x.h === 40)!;
    expect(Math.abs(bm.x! - 8 - (264 - (bm.x! - 8) - bm.w!))).toBeLessThanOrEqual(8);
  });
  it("BARCODE native diakhiri CRLF eksplisit", () => {
    const s = Buffer.from(buildRaw(mk(1), fake, { barcodeMode: "native" })).toString("latin1");
    expect(/BARCODE [^\n]*"\r\n/.test(s)).toBe(true);
    expect(/[^\r]\n/.test(s)).toBe(false);
  });
});

describe("helper", () => {
  it("kolom = 3", () => expect(XP_COLS).toBe(3));
  it("tsplSafe buang kutip & non-ASCII", () => {
    expect(tsplSafe('Kebáya "A" · B')).toBe("Kebaya A - B");
  });
  it("code128Modules: digit panjang lebih ringkas (subset C)", () => {
    expect(code128Modules("123456")).toBeLessThan(code128Modules("ABCDEF"));
  });
  it("code128Modules satu karakter", () => {
    expect(code128Modules("A")).toBe((1 + 2) * 11 + 13);
  });
});
