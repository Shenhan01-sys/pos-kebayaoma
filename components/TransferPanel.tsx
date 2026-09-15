"use client";

// components/TransferPanel.tsx — E11: ringkasan riwayat transfer (per toko yang tampil),
// paralel dengan panel Sewa. Sumber = state transfers (RPC list_transfers: sudah tersegelong
// per pihak terkait). Tidak ada aksi di sini — ajukan/Kirim/Batal tetap di /inventory.

import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import { involvesStore } from "@/lib/transfer";
import { Icon } from "@/components/icons";

export default function TransferPanel() {
  const transfers = useData((s) => s.transfers);
  const stores = useData((s) => s.stores);
  const activeStoreId = useData((s) => s.activeStoreId);
  const auth = useAuth();
  const isManagerAll = auth.staff?.role === "manager" && activeStoreId === null;

  const prefix = (id: string) => stores.find((t) => t.id === id)?.prefix ?? "?";
  const list = (isManagerAll ? transfers : transfers.filter((t) => activeStoreId && involvesStore(t, activeStoreId)))
    .slice(0, 8);

  if (list.length === 0) return null;

  return (
    <div className="card card-pad mb-4">
      <h2 className="section-title mb-2 flex items-center gap-2">
        <Icon name="inventory" size={16} /> Transfer
        <span className="text-xs font-medium text-olive">{list.length} terbaru</span>
      </h2>
      <div className="space-y-1.5">
        {list.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "sent" ? "bg-success/10 text-success" : t.status === "cancelled" ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning"}`}>
              {t.status === "sent" ? "Terkirim" : t.status === "cancelled" ? "Batal" : "Pending"}
            </span>
            <span className="text-ink">{prefix(t.fromStore)} → {prefix(t.toStore)}</span>
            <span className="text-gray-600">{t.productName} × {t.qty}</span>
            <span className="ml-auto text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString("id-ID")}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-olive">Kelola (ajukan/Kirim/Batal) lewat menu Inventori → Transfer.</p>
    </div>
  );
}
