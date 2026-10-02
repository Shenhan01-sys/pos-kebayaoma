"use client";

// components/RentalConfirmModal.tsx — E18: popup khusus sewa di /pos (muncul otomatis setelah "Mulai sewa" dari /sewa).
// Menampilkan ringkasan sewa lalu lanjut ke modal pembayaran POS yang SAMA (QRIS / tunai / transfer + foto bukti).

import { formatRupiah } from "@/lib/dummy";
import { formatDateId, rentalDraftDeposit, rentalDraftTotal, type RentalDraft } from "@/lib/rental";
import { Icon } from "@/components/icons";

export default function RentalConfirmModal({
  draft,
  itemName,
  variantLabel,
  onContinue,
  onCancel,
}: {
  draft: RentalDraft;
  itemName: string;
  variantLabel: string;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const total = rentalDraftTotal(draft);
  const deposit = rentalDraftDeposit(draft);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-label="Konfirmasi sewa">
      <div className="w-full max-w-[420px] rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet/10 text-violet">
            <Icon name="rental" size={18} />
          </span>
          <div>
            <h3 className="text-lg font-bold text-ink">Konfirmasi sewa</h3>
            <p className="text-xs text-gray-600">Periksa data, lalu lanjut ke pembayaran.</p>
          </div>
        </div>

        <div className="mb-3 rounded-2xl bg-beige/60 p-3 text-sm">
          <div className="font-semibold text-ink">{itemName}</div>
          <div className="text-xs text-gray-600">{variantLabel}</div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-olive">Penyewa</dt>
            <dd className="text-right font-medium text-ink">{draft.customerName}{draft.customerPhone ? ` · ${draft.customerPhone}` : ""}</dd>
            <dt className="text-olive">Jumlah</dt>
            <dd className="text-right font-medium text-ink">{draft.qty} unit × {formatRupiah(draft.rentPrice)}</dd>
            <dt className="text-olive">Lama sewa</dt>
            <dd className="text-right font-medium text-ink">{draft.days} hari</dd>
            <dt className="text-olive">Mulai</dt>
            <dd className="text-right font-medium text-ink">{formatDateId(draft.startDate)}</dd>
            <dt className="text-olive">Harus kembali</dt>
            <dd className="text-right font-bold text-violet">{formatDateId(draft.dueDate)}</dd>
          </dl>
        </div>

        <div className="mb-3 space-y-1 rounded-2xl bg-violet/5 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-olive">Biaya sewa (dibayar sekarang)</span>
            <b className="tnum text-ink">{formatRupiah(total)}</b>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between text-xs text-warning">
              <span>Deposit — terima TERPISAH dari penyewa</span>
              <span className="tnum font-semibold">{formatRupiah(deposit)}</span>
            </div>
          )}
        </div>

        <p className="mb-4 text-xs text-gray-600">
          Pembayaran memakai modal yang sama dengan penjualan: pilih QRIS / tunai / transfer dan unggah foto bukti. Stok
          berkurang saat pembayaran lunas dan kembali saat barang diterima di menu Sewa.
        </p>

        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost flex-1 py-2.5">Batalkan sewa</button>
          <button onClick={onContinue} className="btn-primary flex-1 py-2.5">Lanjut ke pembayaran</button>
        </div>
      </div>
    </div>
  );
}
