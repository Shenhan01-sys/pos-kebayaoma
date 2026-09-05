"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  transactions as dummyTx,
  formatRupiah,
  type Transaction,
  type TransactionItem,
  type PaymentMethod,
} from "@/lib/dummy";
import {
  getAllTransactions,
  subscribeTransactions,
  setTransactionStatus,
} from "@/store/cart";
import { useAuth } from "@/store/auth";
import { Icon } from "@/components/icons";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  qris: "QRIS",
  cash: "Cash",
  transfer: "Transfer",
  shopee: "Shopee",
};
const METHODS: PaymentMethod[] = ["qris", "cash", "transfer", "shopee"];

interface ItemRow {
  tx: Transaction;
  item: TransactionItem;
  isFirstOfNota: boolean;
  isLastOfNota: boolean;
  gross: number; // G = qty × unitPrice
  lineCost: number; // E × D (cost×qty)
  margin: number; // J = G − I − lineCost
  runningTotal: number; // H = nota total (akumulasi)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const auth = useAuth();
  const isStaff = auth.staff?.role === "staff";
  const canManage = auth.staff?.role === "manager";
  const [all, setAll] = useState<Transaction[]>([]);
  const [dateFilter, setDateFilter] = useState<string>(todayStr());
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "all">("all");
  const [showVoided, setShowVoided] = useState(false);
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    tx: Transaction;
    action: "cancelled" | "refunded";
  } | null>(null);

  useEffect(() => {
    const sync = () => setAll(getAllTransactions(dummyTx));
    sync();
    return subscribeTransactions(sync);
  }, []);

  const dayTx = useMemo(() => {
    const effectiveDate = isStaff ? todayStr() : dateFilter;
    return all
      .filter((t) => {
        if (!showVoided && (t.status === "cancelled" || t.status === "refunded"))
          return false;
        if (effectiveDate && t.createdAt.slice(0, 10) !== effectiveDate) return false;
        if (methodFilter !== "all" && t.paymentMethod !== methodFilter) return false;
        return true;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [all, dateFilter, methodFilter, showVoided, isStaff]);

  const rows = useMemo<ItemRow[]>(() => {
    const out: ItemRow[] = [];
    for (const tx of dayTx) {
      tx.items.forEach((item, idx) => {
        const gross = item.quantity * item.unitPrice;
        const lineCost = (item.costPrice || 0) * item.quantity;
        const margin = gross - (item.discount || 0) - lineCost;
        out.push({
          tx,
          item,
          isFirstOfNota: idx === 0,
          isLastOfNota: idx === tx.items.length - 1,
          gross,
          lineCost,
          margin,
          runningTotal: tx.total,
        });
      });
    }
    return out;
  }, [dayTx]);

  const recap = useMemo(() => {
    const byMethod: Record<PaymentMethod, number> = {
      qris: 0,
      cash: 0,
      transfer: 0,
      shopee: 0,
    };
    let omset = 0;
    let cost = 0;
    let count = 0;
    for (const tx of dayTx) {
      byMethod[tx.paymentMethod] += tx.total;
      omset += tx.total;
      cost += tx.items.reduce(
        (s, i) => s + (i.costPrice || 0) * i.quantity,
        0
      );
      count += 1;
    }
    return { byMethod, omset, cost, net: omset - cost, count };
  }, [dayTx]);

  function doConfirm() {
    if (!confirm) return;
    setTransactionStatus(confirm.tx.id, confirm.action);
    setConfirm(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          Laporan Transaksi
        </h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            Tanggal
            <input
              type="date"
              value={isStaff ? todayStr() : dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              disabled={isStaff}
              className="input ml-2 py-1.5 text-sm disabled:opacity-60"
            />
          </label>
          <label className="text-xs text-gray-600">
            Metode
            <select
              value={methodFilter}
              onChange={(e) =>
                setMethodFilter(e.target.value as PaymentMethod | "all")
              }
              className="input ml-2 py-1.5 text-sm"
            >
              <option value="all">Semua</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
            />
            Tampilkan void/refund
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Buku besar table B–K */}
        <div className="card flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-beige/70 text-left text-olive">
              <tr>
                <th className="p-2.5 font-semibold">No. Nota</th>
                <th className="p-2.5 font-semibold">Waktu</th>
                <th className="p-2.5 font-semibold">Produk</th>
                <th className="p-2.5 text-right font-semibold">Qty</th>
                <th className="p-2.5 text-right font-semibold">Cost</th>
                <th className="p-2.5 text-right font-semibold">Price</th>
                <th className="p-2.5 text-right font-semibold">Total</th>
                <th className="p-2.5 text-right font-semibold">YT</th>
                <th className="p-2.5 text-right font-semibold">Disc</th>
                <th className="p-2.5 text-right font-semibold">Margin</th>
                <th className="p-2.5 font-semibold">Method</th>
                <th className="p-2.5 font-semibold">Bukti</th>
                <th className="p-2.5 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const voided =
                  r.tx.status === "cancelled" || r.tx.status === "refunded";
                return (
                  <tr
                    key={i}
                    className={[
                      "border-t border-black/5 hover:bg-beige/40",
                      r.isFirstOfNota ? "border-t-2 border-t-olive/20" : "",
                      voided ? "opacity-50 line-through" : "",
                    ].join(" ")}
                  >
                    <td className="p-2.5 align-top">
                      {r.isFirstOfNota ? (
                        <Link
                          href={`/verify/${r.tx.id}`}
                          className="font-semibold text-apricot hover:underline"
                        >
                          {r.tx.number}
                        </Link>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-2.5 align-top text-xs text-gray-600">
                      {r.isFirstOfNota
                        ? new Date(r.tx.createdAt).toLocaleString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "short",
                          })
                        : ""}
                    </td>
                    <td className="p-2.5 align-top font-medium text-ink">
                      {r.item.name}
                      {r.item.size && r.item.size !== "One Size" ? (
                        <span className="ml-1 text-xs text-gray-500">
                          · {r.item.size}
                          {r.item.color ? ` · ${r.item.color}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2.5 text-right align-top tnum">
                      {r.item.quantity}
                    </td>
                    <td className="p-2.5 text-right align-top tnum text-gray-600">
                      {formatRupiah(r.item.costPrice)}
                    </td>
                    <td className="p-2.5 text-right align-top tnum">
                      {formatRupiah(r.item.unitPrice)}
                    </td>
                    <td className="p-2.5 text-right align-top tnum font-medium">
                      {formatRupiah(r.gross)}
                    </td>
                    <td className="p-2.5 text-right align-top tnum font-bold text-olive">
                      {r.isLastOfNota ? formatRupiah(r.runningTotal) : ""}
                    </td>
                    <td className="p-2.5 text-right align-top tnum text-danger">
                      {r.item.discount ? `−${formatRupiah(r.item.discount)}` : "—"}
                    </td>
                    <td
                      className={[
                        "p-2.5 text-right align-top tnum font-semibold",
                        r.margin < 0 ? "text-danger" : "text-olive",
                      ].join(" ")}
                    >
                      {formatRupiah(r.margin)}
                    </td>
                    <td className="p-2.5 align-top">
                      {r.isFirstOfNota ? (
                        <span
                          className={[
                            "pill",
                            r.tx.paymentMethod === "qris"
                              ? "pill-info"
                              : r.tx.paymentMethod === "cash"
                              ? "pill-success"
                              : r.tx.paymentMethod === "shopee"
                              ? "pill-warning"
                              : "pill-soft",
                          ].join(" ")}
                        >
                          {METHOD_LABELS[r.tx.paymentMethod]}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-2.5 align-top">
                      {r.isFirstOfNota ? (
                        r.tx.photoProof ? (
                          <button
                            onClick={() => setPhotoView(r.tx.photoProof!)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet/10 text-violet transition hover:bg-violet/20"
                            title="Lihat foto bukti"
                            aria-label="Lihat foto bukti"
                          >
                            <Icon name="photo" size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-2.5 align-top">
                      {r.isFirstOfNota && r.tx.status === "paid" && canManage ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              setConfirm({ tx: r.tx, action: "cancelled" })
                            }
                            className="btn-danger px-2 py-0.5 text-[10px]"
                          >
                            Batal
                          </button>
                          <button
                            onClick={() =>
                              setConfirm({ tx: r.tx, action: "refunded" })
                            }
                            className="btn-soft px-2 py-0.5 text-[10px]"
                          >
                            Refund
                          </button>
                        </div>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-center text-gray-600"
                    colSpan={13}
                  >
                    Tidak ada transaksi pada {dateFilter || "filter ini"}.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-beige/60 text-olive">
                <tr className="border-t-2 border-olive/30">
                  <td className="p-2.5 font-bold" colSpan={3}>
                    Total {recap.count} nota
                  </td>
                  <td className="p-2.5" colSpan={4}></td>
                  <td className="p-2.5 text-right font-bold tnum">
                    {formatRupiah(recap.omset)}
                  </td>
                  <td className="p-2.5" colSpan={2}></td>
                  <td className="p-2.5 text-right font-bold tnum text-olive">
                    {formatRupiah(recap.net)}
                  </td>
                  <td className="p-2.5" colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Sidebar rekap metode bayar */}
        <aside className="w-full lg:w-72 shrink-0 space-y-3">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-olive">
              Rekap Metode Bayar
            </h2>
            <ul className="space-y-2 text-sm">
              {METHODS.map((m) => (
                <li
                  key={m}
                  className="flex items-center justify-between border-b border-black/5 pb-1.5"
                >
                  <span className="text-gray-700">{METHOD_LABELS[m]}</span>
                  <span className="tnum font-semibold text-ink">
                    {formatRupiah(recap.byMethod[m])}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between pt-1.5 text-base font-bold">
                <span>Total</span>
                <span className="tnum text-olive">
                  {formatRupiah(recap.omset)}
                </span>
              </li>
            </ul>
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-olive">
              Ringkasan
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-700">Omset</dt>
                <dd className="tnum font-semibold text-ink">
                  {formatRupiah(recap.omset)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-700">Cost</dt>
                <dd className="tnum font-semibold text-danger">
                  −{formatRupiah(recap.cost)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-black/10 pt-2 text-base font-bold">
                <dt>Net Income</dt>
                <dd
                  className={[
                    "tnum",
                    recap.net < 0 ? "text-danger" : "text-olive",
                  ].join(" ")}
                >
                  {formatRupiah(recap.net)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-4 text-xs text-gray-600">
            <p className="mb-1.5 font-semibold text-olive">Kolom Buku Besar</p>
            <ul className="space-y-0.5">
              <li><b>Cost</b> = harga modal/unit · snapshot variant</li>
              <li><b>Price</b> = harga jual/unit</li>
              <li><b>Total</b> = Qty × Price (gross)</li>
              <li><b>YT</b> = akumulasi total per nota</li>
              <li><b>Margin</b> = Total − Disc − Cost×Qty</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Photo proof viewer */}
      {photoView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setPhotoView(null)}
        >
          <div
            className="relative max-h-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPhotoView(null)}
              className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-soft-lg"
              aria-label="Tutup"
            >
              <Icon name="close" size={18} />
            </button>
            <img
              src={photoView}
              alt="Bukti Pembayaran"
              className="max-h-[80vh] rounded-2xl shadow-soft-xl"
            />
          </div>
        </div>
      )}

      {/* Cancel / Refund confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-3xl bg-white p-5 text-center shadow-soft-xl">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger">
              <Icon name="alert" size={24} />
            </span>
            <h3 className="mb-1 text-lg font-bold text-ink">
              {confirm.action === "cancelled"
                ? "Batalkan Transaksi?"
                : "Refund Transaksi?"}
            </h3>
            <p className="mb-1 text-sm text-gray-600">
              {confirm.tx.number} · {formatRupiah(confirm.tx.total)}
            </p>
            <p className="mb-4 text-xs text-gray-500">
              Stok akan dikembalikan dan statistik pelanggan diperbarui.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="btn-ghost flex-1">
                Tidak
              </button>
              <button
                onClick={doConfirm}
                className={
                  confirm.action === "cancelled"
                    ? "btn-danger flex-1"
                    : "btn-violet flex-1"
                }
              >
                Ya, {confirm.action === "cancelled" ? "Batalkan" : "Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
