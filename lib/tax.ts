// lib/tax.ts — E4: model pajak INCLUSIVE.
// Harga yang ditampilkan/dibayar SUDAH termasuk pajak. Kolom `tax` DB = PPn TERSIRAT
// (implied), dihitung dari net, BUKAN penambah. Konvensi UMKM: ppn = net - net/(1+r).

export interface TaxBreakdown {
  /** Jumlah yang dibayar = net (harga sudah inclusive). */
  grand: number;
  /** PPn tersirat yang tersimpan di kolom transactions.tax. */
  impliedTax: number;
}

export function inclusiveTax(net: number, ratePct: number): TaxBreakdown {
  if (ratePct <= 0) return { grand: Math.max(0, Math.round(net)), impliedTax: 0 };
  const r = ratePct / 100;
  const implied = net - net / (1 + r);
  return {
    grand: Math.max(0, Math.round(net)),
    impliedTax: Math.max(0, Math.round(implied)),
  };
}
