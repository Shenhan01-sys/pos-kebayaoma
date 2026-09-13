// lib/barcode.ts — E2: konten stiker barcode vendor "VO:<ref>:<vendor_id>".
// Ref = variant_id (utama) atau product_id (fallback produk multi-varian → varian pertama).

export const VO_PREFIX = "VO:";

export function encodeVoBarcode(refId: string, vendorId: string): string {
  return `${VO_PREFIX}${refId}:${vendorId}`;
}

export interface VoPayload {
  refId: string;
  vendorId: string;
}

export function parseVoBarcode(code: string): VoPayload | null {
  if (!code.startsWith(VO_PREFIX)) return null;
  const body = code.slice(VO_PREFIX.length);
  const i = body.lastIndexOf(":");
  if (i <= 0 || i === body.length - 1) return null;
  return { refId: body.slice(0, i), vendorId: body.slice(i + 1) };
}

export interface ScanCandidate {
  productId: string;
  variantId: string;
}

// Resolusi hasil scan: VO:<variant> > VO:<product (varian pertama)> > barcode/SKU biasa.
export function resolveVoScan<T extends ScanCandidate>(
  vo: VoPayload,
  lines: T[]
): T | null {
  const byVariant = lines.find((l) => l.variantId === vo.refId);
  if (byVariant) return byVariant;
  return lines.find((l) => l.productId === vo.refId) ?? null;
}
