// lib/tspl-text.ts — E15: gambar teks label di browser (canvas) → piksel ink untuk BITMAP TSPL.
import type { TextBitmap, TextRenderer } from "./tspl";

const FONT_FAMILY = "Arial, Helvetica, sans-serif";

export function canvasTextRenderer(): TextRenderer {
  const cache = new Map<string, TextBitmap>();
  return (text: string, px: number, bold: boolean): TextBitmap => {
    const key = `${bold ? "b" : "n"}${px}|${text}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const font = `${bold ? "bold " : ""}${px}px ${FONT_FAMILY}`;
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = font;
    const w = Math.max(1, Math.ceil(probe.measureText(text).width));
    const h = Math.ceil(px * 1.25);

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.font = font;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, 0, Math.round(px * 0.9));

    const px4 = ctx.getImageData(0, 0, w, h).data;
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) ink[i] = px4[i * 4] < 140 ? 1 : 0; // R < 140 → tinta
    const bmp = { w, h, ink };
    cache.set(key, bmp);
    return bmp;
  };
}

/** Uint8Array → base64 (aman untuk payload besar) */
export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}
