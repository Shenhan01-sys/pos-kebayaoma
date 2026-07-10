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
import { Icon } from "@/components/icons";

function mockQrisString(amount: number, ref: string): string {
  return `00020101021226ID.CO.KEBAYAOMA.WWW011893600912345678${ref}5204583253033605802ID5909KEBAYAOMA6011JAKARTASELAT6304${String(
    amount
  ).padStart(10, "0")}`;
}

const methodMeta: Record<PaymentMethod, { label: string; icon: "qris" | "cash" | "transfer" }> = {
  qris: { label: "QRIS", icon: "qris" },
  cash: { label: "Tunai", icon: "cash" },
  transfer: { label: "Transfer", icon: "transfer" },
};

export default function CheckoutModal({ onClose }: { onClose: () => void }) {
  const { lines, total, clear, discount, setDiscount, customerName } = useCart();
  const s = useSettings();
  const { adjustStock } = useData();
  const [method, setMethod] = useState<PaymentMethod>("qris");
  const [paid, setPaid] = useState<Transaction | null>(null);
  const [cashPaid, setCashPaid] = useState<string>(String(total()));
  const [ref] = useState(
    () => "QRX-" + Math.random().toString(36).slice(2, 8).toUpperCase()
  );

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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="max-h-full w-full max-w-[380px] overflow-auto rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
          <div className="mb-3 flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-grad-success text-white shadow-glow">
              <Icon name="check" size={30} />
            </span>
            <div className="mt-2 text-lg font-extrabold text-ink">
              Pembayaran Berhasil
            </div>
            <div className="text-sm text-gray-600 tnum">{formatRupiah(grand)}</div>
          </div>
          <Receipt tx={paid} />
          <div className="mt-4 flex gap-2">
            <button onClick={() => window.print()} className="btn-violet flex-1">
              <Icon name="printer" size={16} /> Print Nota
            </button>
            <button
              onClick={() => {
                clear();
                onClose();
              }}
              className="btn-ghost flex-1"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-[440px] overflow-hidden rounded-t-4xl bg-white shadow-soft-xl sm:rounded-3xl">
        <div className="flex items-center justify-between bg-beige px-5 py-4">
          <div>
            <div className="text-xs font-medium text-olive">Total Bayar</div>
            <div className="text-2xl font-extrabold text-ink tnum">{formatRupiah(grand)}</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink"
            aria-label="Tutup"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="card-pad">
          {customerName && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-beige/60 px-3 py-2 text-sm text-olive">
              <Icon name="customers" size={16} /> Pelanggan: {customerName}
            </div>
          )}

          <div className="mb-3 flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Diskon</label>
            <div className="relative ml-auto w-36">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">
                Rp
              </span>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="input pl-9 text-right tnum"
              />
            </div>
          </div>

          {/* Method segmented control */}
          <div className="seg mb-4 w-full">
            {(["qris", "cash", "transfer"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`seg-item flex flex-1 items-center justify-center gap-1.5 ${
                  method === m ? "seg-item-active" : ""
                }`}
              >
                <Icon name={methodMeta[m].icon} size={16} />
                {methodMeta[m].label}
              </button>
            ))}
          </div>

          {method === "qris" && (
            <div className="flex flex-col items-center rounded-2xl bg-beige/60 p-4">
              <div className="rounded-2xl bg-white p-3 shadow-soft">
                <QRCodeSVG value={mockQrisString(grand, ref)} size={176} level="M" />
              </div>
              <p className="mt-2 text-center text-xs text-gray-600">
                Scan dengan e-wallet (dummy). Klik tombol untuk simulasi.
              </p>
            </div>
          )}

          {method === "cash" && (
            <div className="space-y-2 rounded-2xl bg-beige/60 p-4">
              <label className="block text-sm font-medium text-gray-600">Uang Diterima</label>
              <input
                type="number"
                value={cashPaid}
                onChange={(e) => setCashPaid(e.target.value)}
                className="input text-right text-lg font-semibold tnum"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Kembali</span>
                <span className="font-bold text-success tnum">
                  {formatRupiah(Math.max(0, (Number(cashPaid) || 0) - grand))}
                </span>
              </div>
            </div>
          )}

          {method === "transfer" && (
            <p className="rounded-2xl bg-beige/60 p-4 text-sm text-gray-600">
              Instruksi transfer ke rekening tokok (dummy).
            </p>
          )}

          <button onClick={finish} className="btn-primary mt-4 w-full py-3 text-base">
            {method === "qris" ? "Simulasikan Pembayaran" : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}
