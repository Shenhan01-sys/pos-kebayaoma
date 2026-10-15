import { describe, expect, it } from "vitest";
import { RAWBT_MAX_ROWS, RAWBT_PACKAGE, rawbtIntentUrl, shouldUseRawbt } from "./rawbt";
import { buildTsplJob, XP_COLS, type TextRenderer } from "./tspl";

const UA_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 15; 25040RP0AG) AppleWebKit/537.36 Chrome/154.0 Safari/537.36";
const UA_DESKTOP_MODE = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36";
const UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/154.0 Safari/537.36";

// renderer palsu: ukuran sebanding teks label asli (semua piksel tinta = kasus terburuk)
const fake: TextRenderer = (text, px) => {
  const w = Math.max(1, Math.round(text.length * px * 0.55));
  const h = Math.ceil(px * 1.25);
  return { w, h, ink: new Uint8Array(w * h).fill(1) };
};

describe("shouldUseRawbt", () => {
  it("Windows (PC toko dengan print-bridge) → tetap bridge", () => {
    expect(shouldUseRawbt(UA_WIN, 0)).toBe(false);
    expect(shouldUseRawbt(UA_WIN, 10)).toBe(false); // laptop layar sentuh
  });
  it("tablet Android → RawBT, termasuk mode situs desktop (UA Linux + sentuh)", () => {
    expect(shouldUseRawbt(UA_ANDROID, 5)).toBe(true);
    expect(shouldUseRawbt(UA_DESKTOP_MODE, 5)).toBe(true);
  });
  it("desktop non-Windows tanpa layar sentuh → bukan RawBT (jalur bridge lama + pesan)", () => {
    expect(shouldUseRawbt(UA_MAC, 0)).toBe(false);
    expect(shouldUseRawbt(UA_DESKTOP_MODE, 0)).toBe(false);
  });
});

describe("rawbtIntentUrl", () => {
  it("format intent rawbt:base64 dikunci ke paket RawBT", () => {
    expect(rawbtIntentUrl("U0laRQ==")).toBe(
      `intent:base64,U0laRQ==#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`
    );
  });
  it(`job ${RAWBT_MAX_ROWS} baris (batas) tetap jauh di bawah ±1 MB`, () => {
    const labels = Array.from({ length: RAWBT_MAX_ROWS * XP_COLS }, (_, i) => ({
      name: `Kebaya Kutubaru Brokat Panjang ${i}`,
      size: "All Size",
      price: 1250000,
      barcode: `KBY-${String(i).padStart(8, "0")}`,
    }));
    const b64 = Buffer.from(buildTsplJob(labels, fake)).toString("base64");
    expect(rawbtIntentUrl(b64).length).toBeLessThan(300_000);
  });
});
