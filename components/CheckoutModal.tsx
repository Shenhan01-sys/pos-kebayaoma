"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  formatRupiah,
  type PaymentMethod,
  type Transaction,
} from "@/lib/dummy";
import { useCart, addTransaction, nextTxNumber } from "@/store/cart";
import { useSettings } from "@/store/settings";
import { useData } from "@/store/data";
import Receipt from "@/components/Receipt";

function mockQrisString(amount: number, ref: string): string {
  // Pseudo QRIS (dummy) — real integration uses Xendit/Midtrans dynamic QR
  return `00020101021226ID.CO.KEBAYAOMA.WWW011893600912345678${ref}5204583253033605802ID5909KEBAYAOMA6011JAKARTASELAT6304${String(
    amount
  ).padStart(10, "0")}`;
}

export default function CheckoutModal({ onClose }: { onClose: () => void }) {
  const { lines, total, clear, discount, setDiscount, customerName } = useCart();
  const s = useSettings();
  const { adjustStock } = useData();
  const [method, setMethod] = useState<PaymentMethod>("qris");
  const [paid, setPaid] = useState<Transaction | null>(null);
  const [cashPaid, setCashPaid] = useState<string>(
    String(total()).padStart(0, "0")
  );
  const [ref] = useState(() => "QRX-" + Math.random().toString(36).slice(2, 8).toUpperCase());

  const rawSubtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const disc = discount;
  const net = Math.max(0, rawSubtotal - disc);
  const taxAmt = Math.round((net * s.taxRate) / 100);
  const grand = net + taxAmt;

  function buildTx(paymentStatus: Transaction["paymentStatus"], amountPaid: number): Transaction {
    const now = new Date().toISOString();
    return {
      id: "t" + Date.now(),
      number: nextTxNumber(),
      cashier: s.cashierName,
      customerName: customerName ?? undefined,
      status: "paid",
      paymentMethod: method,
      paymentStatus,
      subtotal: rawSubtotal,
      tax: taxAmt,
      discount: disc,
      total: grand,
      amountPaid,
      change: Math.max(0, amountPaid - grand),
      createdAt: now,
      qrisRef: method === "qris" ? ref : undefined,
      items: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        name: l.name,
        sku: l.sku,
        size: l.size,
        color: l.color,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        total: l.unitPrice * l.quantity - l.discount,
      })),
    };
  }

  function finish() {
    const amt = method === "cash" ? Number(cashPaid) || grand : grand;
    const tx = buildTx("paid", amt);
    addTransaction(tx);
    lines.forEach((l) =>
      adjustStock(l.variantId, -l.quantity, "sale", s.cashierName, "Penjualan")
    );
    setPaid(tx);
  }

  if (paid) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-full overflow-auto rounded-xl bg-white p-5 shadow-xl w-[360px]">
          <div className="mb-3 text-center text-green-600 font-bold">
            ✓ Pembayaran Berhasil
          </div>
          <Receipt tx={paid} />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-white text-sm"
            >
              Print Nota
            </button>
            <button
              onClick={() => {
                clear();
                onClose();
              }}
              className="flex-1 rounded-lg bg-gray-200 px-3 py-2 text-sm"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-[420px] max-w-full rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Pembayaran</h2>
          <button onClick={onClose} className="text-gray-400">
            ✕
          </button>
        </div>

        <div className="mb-3 text-right text-xl font-bold text-brand-700">
          {formatRupiah(grand)}
        </div>

        {customerName && (
          <div className="mb-2 text-sm text-olive">Pelanggan: {customerName}</div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <label className="text-sm text-gray-600">Diskon</label>
          <input
            type="number"
            min={0}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="w-32 rounded-lg border px-2 py-1 text-right"
          />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(["qris", "cash", "transfer"] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                method === m
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300"
              }`}
            >
              {m === "qris" ? "QRIS" : m === "cash" ? "Tunai" : "Transfer"}
            </button>
          ))}
        </div>

        {method === "qris" && (
          <div className="flex flex-col items-center">
            <div className="rounded-lg border p-2 bg-white">
              <QRCodeSVG value={mockQrisString(grand, ref)} size={180} level="M" />
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">
              Scan dengan e-wallet (dummy). Klik tombol untuk simulasi.
            </p>
          </div>
        )}

        {method === "cash" && (
          <div className="space-y-2">
            <label className="block text-sm text-gray-600">Uang Diterima</label>
            <input
              type="number"
              value={cashPaid}
              onChange={(e) => setCashPaid(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-right"
            />
            <div className="text-right text-sm">
              Kembali: {formatRupiah(Math.max(0, (Number(cashPaid) || 0) - grand))}
            </div>
          </div>
        )}

        {method === "transfer" && (
          <p className="text-sm text-gray-500">
            Instruksi transfer ke rekening tokok (dummy).
          </p>
        )}

        <button
          onClick={finish}
          className="mt-4 w-full rounded-lg bg-brand-600 px-3 py-3 font-bold text-white"
        >
          {method === "qris" ? "Simulasikan Pembayaran" : "Konfirmasi"}
        </button>
      </div>
    </div>
  );
}
