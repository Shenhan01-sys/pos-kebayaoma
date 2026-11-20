import { describe, expect, it } from "vitest";
import { buildXpLabelSheetHtml, chunkRows } from "./xp-label-html";

const lbl = (i: number) => ({ barcode: `KO${i}`, name: `Kebaya ${i}`, price: 150000 });

describe("chunkRows", () => {
  it("3 label per baris", () => {
    expect(chunkRows([1, 2, 3, 4, 5, 6, 7]).map((r) => r.length)).toEqual([3, 3, 1]);
    expect(chunkRows([])).toEqual([]);
  });
});

describe("buildXpLabelSheetHtml", () => {
  it("satu halaman per baris, ukuran halaman 108×15 mm", () => {
    const html = buildXpLabelSheetHtml([1, 2, 3, 4].map(lbl), (c) => `data:image/png;base64,${c}`);
    expect(html).toContain("@page { size: 108mm 15mm; margin: 0; }");
    expect(html.match(/<section class="row">/g)).toHaveLength(2);
    expect(html.match(/class="lbl"/g)).toHaveLength(4);
    expect(html).toContain('src="data:image/png;base64,KO4"');
    expect(html).toContain("Rp 150.000");
  });
  it("kolom diposisikan sesuai pitch label TSPL", () => {
    const html = buildXpLabelSheetHtml([1, 2, 3].map(lbl), () => "x");
    expect(html).toContain('style="left:1.00mm"');
    expect(html).toContain('style="left:37.25mm"');
    expect(html).toContain('style="left:73.50mm"');
  });
  it("teks di-escape, ukuran ikut di nama", () => {
    const html = buildXpLabelSheetHtml([{ barcode: "A<1>", name: "Kebaya & Co", size: "XL", price: 1 }], () => "x");
    expect(html).toContain("A&lt;1&gt;");
    expect(html).toContain("Kebaya &amp; Co XL");
  });
});
