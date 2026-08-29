"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  formatRupiah,
  type PaymentMethod,
  type Transaction,
  type TransactionItem,
} from "@/lib/dummy";
import { useCart, addTransaction, nextTxNumber } from "@/store/cart";
import { useSettings } from "@/store/settings";
import { useData } from "@/store/data";
import { useAuth } from "@/store/auth";
import Receipt from "@/components/Receipt";
import { Icon } from "@/components/icons";

const methodMeta: Record<PaymentMethod, { label: string; icon: "qris" | "cash" | "transfer" }> = {
  qris: { label: "QRIS", icon: "qris" },
  cash: { label: "Tunai", icon: "cash" },
  transfer: { label: "Transfer", icon: "transfer" },
};

export default function CheckoutModal({ onClose }: { onClose: () => void }) {
  const { lines, discount, setDiscount, setUnitPrice, customerName, clear } = useCart();
  const s = useSettings();
  const auth = useAuth();
  const cashierName = auth.staff?.name ?? s.cashierName;
  const { setTransactionStatus, recordCustomItem } = useData();

  const [method, setMethod] = useState<PaymentMethod>("qris");
  const [paid, setPaid] = useState<Transaction | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [txNumber] = useState(() => nextTxNumber());
  const [customPrompt, setCustomPrompt] = useState<TransactionItem[]>([]);

  const rawSubtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines]
  );
  const lineDiscounts = useMemo(
    () => lines.reduce((sum, l) => sum + l.discount, 0),
    [lines]
  );
  const disc = discount + lineDiscounts;
  const net = Math.max(0, rawSubtotal - disc);
  const taxAmt = Math.round(net * (s.taxRate / 100));
  const grand = net + taxAmt;

  const [cashPaid, setCashPaid] = useState(String(grand));
  useEffect(() => setCashPaid(String(grand)), [grand]);

  const [qr, setQr] = useState<{ qrString: string; qrisRef: string; mock: boolean; expiry?: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [negoOpen, setNegoOpen] = useState(false);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Request dynamic QRIS whenever amount/method changes
  useEffect(() => {
    if (method !== "qris") return;
    let cancelled = false;
    setQrLoading(true);
    setError(null);
    fetch("/api/qris/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: txNumber, gross_amount: grand }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setQr(null);
        } else {
          setQr({
            qrString: d.qrString,
            qrisRef: d.qrisRef,
            mock: !!d.mock,
            expiry: d.expiry,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => !cancelled && setQrLoading(false));
    return () => {
      cancelled = true;
    };
  }, [method, grand, txNumber]);

  // Listen for pending QRIS transaction → paid (via realtime)
  useEffect(() => {
    if (!pendingId) return;
    const unsub = useData.subscribe((state) => {
      const tx = state.transactions.find((t) => t.id === pendingId);
      if (tx?.status === "paid") {
        setCustomPrompt(tx.items.filter((i) => i.productId === "custom"));
        setPaid(tx);
        setPendingId(null);
      }
    });
    return unsub;
  }, [pendingId]);

  // Polling fallback: cek status QRIS tiap 3 detik kalau realtime belum sampai
  useEffect(() => {
    if (!pendingId || !qr || qr.mock) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/qris/status?ref=${encodeURIComponent(qr.qrisRef)}`);
        if (cancelled) return;
        const data = await res.json();
        if (data.status === "paid") {
          await useData.getState().fetchTransactions();
          const tx = useData.getState().transactions.find((t) => t.id === pendingId);
          if (tx?.status === "paid") {
            setCustomPrompt(tx.items.filter((i) => i.productId === "custom"));
            setPaid(tx);
            setPendingId(null);
          }
        }
      } catch {
        // Poll gagal, coba lagi nanti
      }
    };
    const interval = setInterval(poll, 3000);
    poll(); // Cek langsung
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingId, qr]);

  function buildTx(
    status: Transaction["status"],
    paymentStatus: Transaction["paymentStatus"],
    amountPaid: number
  ): Transaction {
    const now = new Date().toISOString();
    return {
      id: "t" + Date.now(),
      number: txNumber,
      cashier: cashierName,
      customerName: customerName ?? undefined,
      status,
      paymentMethod: method,
      paymentStatus,
      subtotal: rawSubtotal,
      tax: taxAmt,
      discount: disc,
      total: grand,
      amountPaid,
      change: Math.max(0, amountPaid - grand),
      createdAt: now,
      qrisRef: method === "qris" ? qr?.qrisRef : undefined,
      photoProof: photo ?? undefined,
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

  async function finish() {
    setError(null);

    if (!photo) {
      setError("Foto bukti pembayaran wajib diunggah.");
      return;
    }

    if (method === "cash") {
      const amt = Number(cashPaid) || 0;
      if (amt < grand) {
        setError("Uang diterima kurang dari total bayar.");
        return;
      }
      const tx = buildTx("paid", "paid", amt);
      const saved = await addTransaction(tx);
      if (saved) {
        setCustomPrompt(saved.items.filter((i) => i.productId === "custom"));
        setPaid(saved);
      }
      return;
    }

    if (method === "transfer") {
      const tx = buildTx("paid", "paid", grand);
      const saved = await addTransaction(tx);
      if (saved) {
        setCustomPrompt(saved.items.filter((i) => i.productId === "custom"));
        setPaid(saved);
      }
      return;
    }

    // QRIS
    if (qr?.mock) {
      const tx = buildTx("paid", "paid", grand);
      const saved = await addTransaction(tx);
      if (saved) {
        setCustomPrompt(saved.items.filter((i) => i.productId === "custom"));
        setPaid(saved);
      }
      return;
    }

    // Real QRIS: buat transaksi pending, tunggu webhook/realtime
    const tx = buildTx("pending", "pending", 0);
    const saved = await addTransaction(tx);
    if (saved) setPendingId(saved.id);
  }

  async function cancelPending() {
    if (pendingId) {
      await setTransactionStatus(pendingId, "cancelled");
    }
    setPendingId(null);
  }

  if (paid) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="max-h-full w-full max-w-[380px] overflow-auto rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
          <div className="mb-3 flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-glow">
              <Icon name="check" size={30} />
            </span>
            <div className="mt-2 text-lg font-extrabold text-ink">Pembayaran Berhasil</div>
            <div className="text-sm text-gray-600 tnum">{formatRupiah(grand)}</div>
          </div>
          <Receipt tx={paid} />

          {customPrompt.length > 0 && (
            <div className="mt-4 rounded-2xl bg-apricot/10 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-olive">
                <Icon name="alert" size={16} /> Simpan item custom ke catalog?
              </div>
              <p className="mb-3 text-xs text-gray-600">
                Item berikut tidak ada di catalog. Transaksi sudah tersimpan. Mau simpan untuk pakai lagi?
              </p>
              <div className="space-y-2">
                {customPrompt.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-2xl bg-white p-2.5 shadow-soft">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{item.name}</div>
                      <div className="text-xs text-gray-600 tnum">{formatRupiah(item.unitPrice)} · qty {item.quantity}</div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={async () => {
                          await recordCustomItem(item);
                          setCustomPrompt((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="btn-violet px-3 py-1.5 text-xs"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => setCustomPrompt((prev) => prev.filter((_, i) => i !== idx))}
                        className="btn-ghost px-3 py-1.5 text-xs"
                      >
                        Lewati
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

  if (pendingId) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="w-full max-w-[380px] overflow-hidden rounded-t-4xl bg-white p-5 text-center shadow-soft-xl sm:rounded-3xl">
          <div className="mb-3 flex flex-col items-center">
            <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-apricot/20 text-apricot">
              <Icon name="qris" size={28} />
            </span>
            <h2 className="mt-3 text-lg font-extrabold text-ink">Menunggu Pembayaran QRIS</h2>
            <p className="text-sm text-gray-600">{txNumber}</p>
          </div>

          {qr && (
            <div className="mx-auto mb-3 w-fit rounded-2xl bg-white p-3 shadow-soft">
              <QRCodeSVG value={qr.qrString} size={176} level="M" />
            </div>
          )}

          <p className="text-sm text-gray-600">
            Minta pelanggan scan QR di atas. Transaksi akan otomatis terkonfirmasi setelah pembayaran diterima.
          </p>
          {qr?.expiry && (
            <p className="mt-1 text-xs text-olive">
              Berlaku s.d. {new Date(qr.expiry).toLocaleTimeString("id-ID")}
            </p>
          )}
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Memeriksa status pembayaran…
          </p>

          <div className="mt-5 flex gap-2">
            <button onClick={cancelPending} className="btn-ghost flex-1">
              Batalkan
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

          {/* Breakdown */}
          <div className="mb-3 space-y-1 rounded-2xl bg-beige/60 p-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="tnum">{formatRupiah(rawSubtotal)}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Diskon</span>
                <span className="tnum">-{formatRupiah(disc)}</span>
              </div>
            )}
            {taxAmt > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Pajak ({s.taxRate}%)</span>
                <span className="tnum">{formatRupiah(taxAmt)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-black/10 pt-1 font-semibold text-ink">
              <span>Total</span>
              <span className="tnum">{formatRupiah(grand)}</span>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Diskon Tambahan</label>
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

          {/* Price negotiation */}
          <button
            onClick={() => setNegoOpen((v) => !v)}
            className="mb-3 flex w-full items-center gap-2 rounded-2xl bg-violet/5 px-3 py-2.5 text-sm font-semibold text-violet transition hover:bg-violet/10"
          >
            <Icon name="tag" size={16} /> Nego Harga per Item
            <Icon name={negoOpen ? "minus" : "plus"} size={14} className="ml-auto" />
          </button>
          {negoOpen && (
            <div className="mb-3 space-y-2">
              {lines.map((l) => {
                const profit = l.unitPrice - l.costPrice;
                const margin = l.costPrice > 0 ? Math.round((profit / l.costPrice) * 100) : 100;
                const atCost = l.costPrice > 0 && l.unitPrice <= l.costPrice;
                return (
                  <div key={l.key} className="rounded-2xl bg-beige/60 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{l.name} <span className="text-xs text-gray-600">· {l.seriesName}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">Rp</span>
                        <input
                          type="number"
                          min={l.costPrice}
                          value={l.unitPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            if (l.costPrice > 0 && val < l.costPrice) {
                              setUnitPrice(l.key, l.costPrice);
                            } else {
                              setUnitPrice(l.key, val);
                            }
                          }}
                          className="input pl-9 text-right text-sm font-semibold tnum"
                        />
                      </div>
                      <span className={`text-xs font-bold ${atCost ? "text-danger" : margin < 20 ? "text-warning" : "text-success"}`}>
                        {atCost ? "⚠ Margin 0%" : `Margin ${margin}%`}
                      </span>
                    </div>
                    {atCost && l.costPrice > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                        <Icon name="alert" size={12} /> Harga tidak boleh di bawah modal
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
              {qrLoading || !qr ? (
                <div className="flex h-[176px] w-[176px] items-center justify-center rounded-2xl bg-white text-sm text-gray-500 shadow-soft">
                  Membuat QR…
                </div>
              ) : (
                <div className="rounded-2xl bg-white p-3 shadow-soft">
                  <QRCodeSVG value={qr.qrString} size={176} level="M" />
                </div>
              )}
              <p className="mt-2 text-center text-xs text-gray-600">
                {qr?.mock
                  ? "Mode simulasi (tanpa key Midtrans). Klik tombol untuk menyelesaikan."
                  : "Scan dengan GoPay / ShopeePay / OVO / e-wallet QRIS."}
              </p>
              {qr?.expiry && (
                <p className="mt-1 text-[11px] text-olive">
                  Berlaku s.d. {new Date(qr.expiry).toLocaleTimeString("id-ID")}
                </p>
              )}
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
              Konfirmasi setelah transfer masuk. Sistem akan mencatat sebagai lunas.
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-danger/10 p-3 text-sm text-danger">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          {/* Photo proof */}
          <div className="mt-3 rounded-2xl bg-beige/60 p-3">
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-olive">
              <Icon name="camera" size={16} /> Foto Bukti Pembayaran
              <span className="text-danger">*</span>
            </label>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Bukti" className="max-h-40 w-full rounded-2xl object-cover" />
                <button
                  onClick={() => setPhoto(null)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                  aria-label="Hapus foto"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/15 p-5 text-center text-sm text-gray-500 transition hover:border-apricot hover:text-apricot">
                <Icon name="camera" size={28} className="text-olive" />
                <span>Ketuk untuk ambil / upload foto</span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              </label>
            )}
          </div>

          <button onClick={finish} className="btn-primary mt-4 w-full py-3 text-base">
            {method === "qris"
              ? qr?.mock
                ? "Simulasikan Pembayaran"
                : "Bayar via QRIS"
              : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}
