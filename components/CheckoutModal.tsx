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
import { inclusiveTax } from "@/lib/tax";
import { Icon } from "@/components/icons";

const methodMeta: Record<PaymentMethod, { label: string; icon: "qris" | "cash" | "transfer" | "shopee" }> = {
  qris: { label: "QRIS", icon: "qris" },
  cash: { label: "Tunai", icon: "cash" },
  transfer: { label: "Transfer", icon: "transfer" },
  shopee: { label: "Shopee", icon: "transfer" },
};

export default function CheckoutModal({ onClose }: { onClose: () => void }) {
  const { lines, discount, setDiscount, setUnitPrice, customerName, clear } = useCart();
  const s = useSettings();
  const auth = useAuth();
  const cashierName = auth.staff?.name ?? s.cashierName;
  const { products, setTransactionStatus, recordCustomItem } = useData();
  const activeStoreId = useData((s) => s.activeStoreId);
  const stores = useData((s) => s.stores);
  const storePrefix =
    stores.find((t) => t.id === activeStoreId)?.prefix ?? "TRX-";

  const [method, setMethod] = useState<PaymentMethod>("qris");
  const [paid, setPaid] = useState<Transaction | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [txNumber] = useState(() => nextTxNumber(storePrefix));
  const [customPrompt, setCustomPrompt] = useState<TransactionItem[]>([]);
  // E6: Pre-order DP
  const [po, setPo] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [dpStr, setDpStr] = useState("");

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
 // Diskon maximum = pendapatan (setelah diskon per baris) dikurangi total modal.
 // Baris bonus (unitPrice === 0) dikecualikan dari total modal.
 const discMax = Math.max(
 0,
 lines.reduce((a, l) => a + l.unitPrice * l.quantity - l.discount, 0) -
 lines.reduce((a, l) => a + (l.unitPrice === 0 ? 0 : l.costPrice * l.quantity), 0)
 );
  // E4: model INCLUSIVE — harga sudah termasuk pajak. grand = net (TANPA ditambah).
  // taxAmt = PPn TERSIRAT yang disimpan di kolom transactions.tax (bukan penambah).
  const { grand, impliedTax: taxAmt } = inclusiveTax(net, s.taxRate);

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
    // Kompres ke max 1024px JPEG 0.7 — foto HP mentah (3-5MB base64) adalah
    // penyebab utama QuotaExceededError di localStorage 'kebaya-oma-data'.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        setPhoto(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        // Fallback: baca mentah bila canvas gagal
        const reader = new FileReader();
        reader.onload = () => setPhoto(reader.result as string);
        reader.readAsDataURL(file);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    };
    img.src = url;
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
        costPrice: l.costPrice,
        discount: l.discount,
        total: l.unitPrice * l.quantity - l.discount,
        vendorId: l.vendorId ?? null,
      })),
    };
  }

  async function saveTx(tx: Transaction): Promise<Transaction | null> {
    const saved = await addTransaction(tx);
    if (!saved) {
      // saveTransaction gagal (misal toko operasional belum dipilih) — tampilkan,
      // jangan stuck diam. Transaksi offline tetap antre via saveTransaction.
      setError(useData.getState().error ?? "Gagal menyimpan transaksi.");
    }
    return saved;
  }

  async function finish() {
    setError(null);

    const lacking = lines.filter((l) => {
      const p = products.find((p) => p.id === l.productId);
      return p ? l.quantity > p.stock : false;
    });
    if (lacking.length > 0) {
      setError(
        `Stok tidak cukup: ${lacking
          .map((l) => {
            const s = products.find((p) => p.id === l.productId)?.stock ?? 0;
            return `${l.name} (minta ${l.quantity}, sisa ${s})`;
          })
          .join("; ")}. Kurangi qty di keranjang dulu.`
      );
      return;
    }

    if (!photo) {
      setError("Foto bukti pembayaran wajib diunggah.");
      return;
    }

    // ===== E6 PRE-ORDER (DP) : status partial → trigger pending->partial reserve stok =====
    if (po) {
      const dp = Number(dpStr) || 0;
      if (dp <= 0 || dp >= grand) {
        setError("DP harus > 0 dan kurang dari total. Sisa bayar dicatat saat pelunasan.");
        return;
      }
      if (!dueDate) {
        setError("Isi tanggal jatuh tempo pelunasan.");
        return;
      }
      if (method === "qris") {
        setError("Pre-order: pilih metode Tunai/Transfer untuk pembayaran DP.");
        return;
      }
      const tx: Transaction = {
        ...buildTx("partial", "paid", dp),
        kind: "preorder",
        dueDate,
        dpAmount: dp,
        dpMethod: method,
        change: 0,
      };
      const saved = await saveTx(tx);
      if (saved) {
        setCustomPrompt(saved.items.filter((i) => i.productId === "custom"));
        setPaid(saved);
      }
      return;
    }

    if (method === "cash") {
      const amt = Number(cashPaid) || 0;
      if (amt < grand) {
        setError("Uang diterima kurang dari total bayar.");
        return;
      }
      const tx = buildTx("paid", "paid", amt);
      const saved = await saveTx(tx);
      if (saved) {
        setCustomPrompt(saved.items.filter((i) => i.productId === "custom"));
        setPaid(saved);
      }
      return;
    }

    if (method === "transfer") {
      const tx = buildTx("paid", "paid", grand);
      const saved = await saveTx(tx);
      if (saved) {
        setCustomPrompt(saved.items.filter((i) => i.productId === "custom"));
        setPaid(saved);
      }
      return;
    }

    // QRIS
    if (qr?.mock) {
      const tx = buildTx("paid", "paid", grand);
      const saved = await saveTx(tx);
      if (saved) {
        setCustomPrompt(saved.items.filter((i) => i.productId === "custom"));
        setPaid(saved);
      }
      return;
    }

    // Real QRIS: buat transaksi pending, tunggu webhook/realtime
    const tx = buildTx("pending", "pending", 0);
    const saved = await saveTx(tx);
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
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Sudah termasuk pajak {s.taxRate}%</span>
                <span className="tnum">({formatRupiah(taxAmt)})</span>
              </div>
            )}
            <div className="flex justify-between border-t border-black/10 pt-1 font-semibold text-ink">
              <span>Total</span>
              <span className="tnum">{formatRupiah(grand)}</span>
            </div>
          </div>

 <div className="mb-1 flex items-center gap-2">
 <label className="text-sm font-medium text-gray-600">Diskon Tambahan</label>
 <div className="relative ml-auto w-36">
 <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">
 Rp
 </span>
 <input
 type="number"
 min={0}
 max={discMax}
 value={discount}
 onChange={(e) => setDiscount(Number(e.target.value) || 0)}
 className="input pl-9 text-right tnum"
 />
 </div>
 </div>
 {disc > 0 && discount >= discMax && (
 <p className="mb-3 flex items-center gap-1.5 text-xs text-danger">
 <Icon name="alert" size={12} /> Diskon dibatasi — tidak boleh membuat pendapatan di bawah total modal.
 </p>
 )}

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
 const isBonus = l.unitPrice === 0;
 // Konvensi UMKM: % untung = untung ÷ modal (sama dengan ProductForm).
 const hasCost = l.costPrice > 0;
 const margin = hasCost ? Math.round(((l.unitPrice - l.costPrice) / l.costPrice) * 100) : null;
 const atCost = !isBonus && hasCost && l.unitPrice <= l.costPrice;
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
                            if (val === 0) {
                              // Bonus Rp0 disengaja — jangan clamp ke modal
                              setUnitPrice(l.key, 0);
                            } else if (l.costPrice > 0 && val < l.costPrice) {
                              setUnitPrice(l.key, l.costPrice);
                            } else {
                              setUnitPrice(l.key, val);
                            }
                          }}
                          className="input pl-9 text-right text-sm font-semibold tnum"
                        />
                      </div>
 <span className={`text-xs font-bold ${isBonus ? "text-violet" : atCost ? "text-danger" : margin === null ? "text-gray-500" : margin < 20 ? "text-warning" : "text-success"}`}>
 {isBonus ? "🎁 Bonus" : atCost ? "⚠ Modal pas-pasan" : margin === null ? "Tanpa modal" : `Untung ${margin}% dr modal`}
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

          {/* E6 Pre-order */}
          <button
            onClick={() => setPo((v) => !v)}
            className={`mb-3 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
              po ? "bg-apricot/20 text-ink ring-1 ring-apricot" : "bg-beige/60 text-gray-600 hover:bg-beige"
            }`}
          >
            <Icon name="shifts" size={16} /> Pre-order (bayar DP dulu)
            <span className={`ml-auto inline-flex h-5 w-9 items-center rounded-full p-0.5 transition ${po ? "justify-end bg-apricot" : "justify-start bg-black/15"}`}>
              <span className="block h-4 w-4 rounded-full bg-white shadow" />
            </span>
          </button>
          {po && (
            <div className="mb-3 space-y-2 rounded-2xl bg-apricot/10 p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <label className="text-olive">Jatuh tempo pelunasan</label>
                <input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} className="input w-auto" />
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <label className="text-olive">Uang muka (DP)</label>
                <input type="number" min={0} value={dpStr} onChange={(e) => setDpStr(e.target.value)} className="input w-32 text-right tnum" placeholder={`${Math.round(grand / 2)}`} />
              </div>
              <p className="text-xs text-gray-600">
                Stok dicadangkan saat DP. Sisa <b className="tnum">{formatRupiah(Math.max(0, grand - (Number(dpStr) || 0)))}</b> dilunasi lewat tombol Lunas di /transactions. Metode DP ikut tercatat.
              </p>
            </div>
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
