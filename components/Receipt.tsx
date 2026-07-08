import { QRCodeSVG } from "qrcode.react";
import { formatRupiah, type Transaction } from "@/lib/dummy";
import { useSettings } from "@/store/settings";

export default function Receipt({ tx }: { tx: Transaction }) {
  const s = useSettings();
  const verifyUrl =
    (typeof window !== "undefined" ? window.location.origin : "https://kebaya-oma.id") +
    "/verify/" +
    tx.id;

  return (
    <div id="print-area" className="font-mono text-[12px] leading-tight">
      <div className="text-center font-bold text-sm">{s.storeName.toUpperCase()}</div>
      <div className="text-center">{s.address}</div>
      <div className="text-center">Telp: {s.phone}</div>
      <div className="my-1 border-t border-dashed border-black" />
      <div>{tx.number}</div>
      <div>{new Date(tx.createdAt).toLocaleString("id-ID")}</div>
      <div>Kasir: {tx.cashier}</div>
      {tx.customerName && <div>Pelanggan: {tx.customerName}</div>}
      <div className="my-1 border-t border-dashed border-black" />
      {tx.items.map((it, i) => (
        <div key={i} className="mb-0.5">
          <div>{it.name}</div>
          <div className="flex justify-between">
            <span>
              {it.size} / {it.color} x{it.quantity}
            </span>
            <span>{formatRupiah(it.total)}</span>
          </div>
        </div>
      ))}
      <div className="my-1 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatRupiah(tx.subtotal)}</span>
      </div>
      {tx.discount > 0 && (
        <div className="flex justify-between">
          <span>Diskon</span>
          <span>-{formatRupiah(tx.discount)}</span>
        </div>
      )}
      {tx.tax > 0 && (
        <div className="flex justify-between">
          <span>Pajak</span>
          <span>{formatRupiah(tx.tax)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{formatRupiah(tx.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Bayar ({tx.paymentMethod.toUpperCase()})</span>
        <span>{formatRupiah(tx.amountPaid)}</span>
      </div>
      {tx.change > 0 && (
        <div className="flex justify-between">
          <span>Kembali</span>
          <span>{formatRupiah(tx.change)}</span>
        </div>
      )}
      <div className="my-1 border-t border-dashed border-black" />
      <div className="flex justify-center py-1">
        <QRCodeSVG value={verifyUrl} size={84} level="M" />
      </div>
      <div className="text-center text-[10px]">Scan untuk verifikasi resmi</div>
      <div className="text-center">Terima kasih 🙏</div>
      <div className="text-center text-[10px]">Barang tidak bisa dikembalikan</div>
    </div>
  );
}
