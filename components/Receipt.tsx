import { QRCodeSVG } from "qrcode.react";
import { formatRupiah, type Transaction } from "@/lib/dummy";
import { useSettings } from "@/store/settings";

export default function Receipt({ tx }: { tx: Transaction }) {
  const s = useSettings();
  const verifyUrl =
    (typeof window !== "undefined" ? window.location.origin : "https://kebaya-oma.id") +
    "/verify/" +
    tx.id;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div
      id="print-area"
      className="relative rounded-2xl bg-[#FBF7E8] p-4 font-mono text-[12px] leading-tight text-ink shadow-soft"
    >
      {/* Ticket cutout notches */}
      <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white" />
      <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white" />
      <div className="text-center text-sm font-extrabold tracking-wide">
        {s.storeName.toUpperCase()}
      </div>
      <div className="text-center text-[11px]">{s.address}</div>
      <div className="text-center text-[11px]">Telp: {s.phone}</div>

      <div className="my-2 border-t border-dashed border-black/30" />

      <div>{tx.number}</div>
      <div>{new Date(tx.createdAt).toLocaleString("id-ID")}</div>
      <div>Kasir: {tx.cashier}</div>
      {tx.customerName && <div>Pelanggan: {tx.customerName}</div>}

      <div className="my-2 border-t border-dashed border-black/30" />

      {tx.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div className="font-semibold">{it.name}</div>
          <div className="flex justify-between">
            <span>
              {it.size} / {it.color} x{it.quantity}
            </span>
            <span>{formatRupiah(it.total)}</span>
          </div>
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-black/30" />

      <Row label="Subtotal" value={formatRupiah(tx.subtotal)} />
      {tx.discount > 0 && (
        <Row label="Diskon" value={"-" + formatRupiah(tx.discount)} />
      )}
      {tx.tax > 0 && <Row label="Pajak" value={formatRupiah(tx.tax)} />}
      <div className="my-1 border-t border-dashed border-black/30" />
      <div className="flex justify-between text-[13px] font-extrabold">
        <span>TOTAL</span>
        <span>{formatRupiah(tx.total)}</span>
      </div>
      <Row label={"Bayar (" + tx.paymentMethod.toUpperCase() + ")"} value={formatRupiah(tx.amountPaid)} />
      {tx.change > 0 && <Row label="Kembali" value={formatRupiah(tx.change)} />}

      <div className="my-2 border-t border-dashed border-black/30" />

      <div className="flex flex-col items-center py-1">
        <div className="rounded-lg bg-white p-1.5 shadow-soft">
          <QRCodeSVG value={verifyUrl} size={84} level="M" />
        </div>
        <div className="mt-1 text-center text-[10px]">Scan untuk verifikasi resmi</div>
      </div>
      <div className="text-center text-[11px] font-semibold">Terima kasih</div>
      <div className="text-center text-[10px] text-gray-600">
        Barang tidak bisa dikembalikan
      </div>
    </div>
  );
}
