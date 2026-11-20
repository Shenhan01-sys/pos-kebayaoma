"use client";

// components/RentalNewModal.tsx — E17/E18: sewa baru dari halaman /sewa. "Mulai sewa" TIDAK menyimpan di sini: draft dibawa ke
// keranjang POS (/pos) → popup konfirmasi sewa → modal pembayaran yang sama dengan penjualan (QRIS/tunai/transfer + foto bukti).
// Multi-barang (keluhan staf: "belum bisa add item yang berbeda dalam 1 nota"): SATU penyewa + SATU periode (mulai/lama),
// daftar N barang. Tiap barang: pilih varian (semua varian bertok; yang belum punya Harga Sewa memakai DEFAULT persen dari
// harga jual — revisi 2), atur jumlah, harga sewa (chip persen) & deposit per unit → "Tambah ke daftar".
// Dibuka dengan `initial` (draft di keranjang) → isian & daftar terisi; dipakai tombol "Tambah item sewa" di POS.
// Tarif flat per unit + deposit per unit; jatuh tempo = mulai + hari; penyewa auto-create.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, type Product, type Variant } from "@/lib/dummy";
import { useData } from "@/store/data";
import { useCart } from "@/store/cart";
import {
  DEFAULT_RENTAL_PCT,
  RENTAL_PCT_OPTIONS,
  addDays,
  buildRentalDraft,
  formatDateId,
  rentTotal,
  rentalPriceFromPct,
  resolveRentalPrice,
  validateRentalDraft,
  type RentalDraft,
} from "@/lib/rental";
import { Icon } from "@/components/icons";

interface Pick {
  product: Product;
  variant: Variant;
  /** harga sewa per unit awal (harga varian bila diatur, kalau tidak default persen) */
  price: number;
  /** true = harga sewa varian belum diatur → memakai default persen */
  isDefault: boolean;
}

/** satu baris di daftar barang sewa */
interface Line extends Pick {
  qty: number;
  rentPrice: number;
  deposit: number;
}

/** isian barang yang sedang diatur; index = baris yang diubah (null = baris baru) */
interface Editor extends Pick {
  qty: number;
  rentPrice: number;
  deposit: number;
  index: number | null;
}

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // tanggal LOKAL (bukan UTC)
};

const variantLabel = (v: Variant) => [v.name, v.size, v.color].filter(Boolean).join(" · ");

export default function RentalNewModal({ onClose, initial = null }: { onClose: () => void; initial?: RentalDraft | null }) {
  const products = useData((s) => s.products);
  const customers = useData((s) => s.customers);
  const activeStoreId = useData((s) => s.activeStoreId);
  const router = useRouter();

  // prefill dari draft di keranjang (tombol "Tambah item sewa" di POS); barang yang tak ditemukan lagi dilewati
  const [prefill] = useState(() => {
    const lines: Line[] = [];
    let missing = 0;
    for (const l of initial?.lines ?? []) {
      const product = products.find((p) => p.id === l.productId);
      const variant = product?.variants.find((v) => v.id === l.variantId);
      if (!product || !variant) { missing++; continue; }
      const r = resolveRentalPrice(variant.sellingPrice, variant.rentalPrice);
      lines.push({ product, variant, price: r.price ?? l.rentPrice, isDefault: r.isDefault, qty: l.qty, rentPrice: l.rentPrice, deposit: l.deposit ?? 0 });
    }
    return { lines, missing };
  });

  const [lines, setLines] = useState<Line[]>(prefill.lines);
  const [view, setView] = useState<"list" | "pick" | "edit">(prefill.lines.length > 0 ? "list" : "pick");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [days, setDays] = useState(initial?.days ?? 3);
  const [daysTouched, setDaysTouched] = useState(!!initial);
  const [name, setName] = useState(initial?.customerName ?? "");
  const [phone, setPhone] = useState(initial?.customerPhone ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);

  /** qty produk ini yang sudah ada di daftar (stok per PRODUK), kecuali baris `except` */
  const reserved = (productId: string, except: number | null = null) =>
    lines.reduce((s, l, i) => (i !== except && l.product.id === productId ? s + l.qty : s), 0);

  // Barang yang bisa disewa: SEMUA varian bertok. Harga sewa belum diatur → default persen dari harga jual
  // (varian tanpa harga jual & tanpa harga sewa tidak bisa dihitung → tidak ditampilkan).
  // Yang sudah diatur harga sewanya tampil lebih dulu.
  const rentable = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: Pick[] = [];
    for (const p of products) {
      if (p.stock <= 0) continue;
      for (const v of p.variants) {
        const r = resolveRentalPrice(v.sellingPrice, v.rentalPrice);
        if (r.price == null) continue;
        if (needle && !`${p.name} ${v.name} ${v.size} ${v.color}`.toLowerCase().includes(needle)) continue;
        out.push({ product: p, variant: v, price: r.price, isDefault: r.isDefault });
      }
    }
    out.sort((a, b) => Number(a.isDefault) - Number(b.isDefault) || a.product.name.localeCompare(b.product.name));
    return out;
  }, [products, q]);

  function choose(p: Pick) {
    // varian yang sudah di daftar → buka baris itu (ubah jumlahnya), bukan baris kembar
    const idx = lines.findIndex((l) => l.variant.id === p.variant.id);
    if (idx >= 0) {
      const l = lines[idx];
      setEditor({ ...l, index: idx });
    } else {
      setEditor({ ...p, qty: 1, rentPrice: p.price, deposit: p.variant.depositPrice ?? 0, index: null });
    }
    setEditErr(null);
    setView("edit");
  }

  function editLine(i: number) {
    setEditor({ ...lines[i], index: i });
    setEditErr(null);
    setView("edit");
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, j) => j !== i));
    setErr(null);
  }

  function commitEditor() {
    if (!editor) return;
    const left = editor.product.stock - reserved(editor.product.id, editor.index);
    if (!(editor.qty >= 1)) { setEditErr("Jumlah minimal 1."); return; }
    if (editor.qty > left) {
      const used = editor.product.stock - left;
      setEditErr(`Stok ${editor.product.name} hanya ${editor.product.stock}${used > 0 ? ` (${used} sudah di daftar)` : ""}.`);
      return;
    }
    if (!(editor.rentPrice > 0)) { setEditErr("Harga sewa harus lebih dari 0."); return; }
    if (editor.deposit < 0) { setEditErr("Deposit tidak boleh negatif."); return; }
    const { index, ...rest } = editor;
    const line: Line = rest;
    if (index === null) {
      setLines((ls) => [...ls, line]);
      if (!daysTouched && lines.length === 0) setDays(editor.variant.rentalDays ?? 3); // lama sewa default dari barang pertama
    } else {
      setLines((ls) => ls.map((l, j) => (j === index ? line : l)));
    }
    setEditor(null);
    setEditErr(null);
    setErr(null);
    setQ("");
    setView("list");
  }

  const due = addDays(startDate, days);
  const total = lines.reduce((s, l) => s + rentTotal(l.rentPrice, l.qty), 0);
  const depositTotal = lines.reduce((s, l) => s + l.deposit * l.qty, 0);
  const units = lines.reduce((s, l) => s + l.qty, 0);

  function submit() {
    if (!activeStoreId) { setErr("Pilih toko operasional (MJ/ML) dulu."); return; }
    const draft = buildRentalDraft({
      days,
      startDate,
      customerName: name,
      customerPhone: phone,
      lines: lines.map((l) => ({
        productId: l.product.id,
        variantId: l.variant.id,
        qty: l.qty,
        rentPrice: l.rentPrice,
        deposit: l.deposit > 0 ? l.deposit : null,
      })),
    });
    const problem = validateRentalDraft(
      draft,
      (id) => products.find((p) => p.id === id)?.stock,
      (id) => products.find((p) => p.id === id)?.name
    );
    if (problem) { setErr(problem); return; }
    const cart = useCart.getState();
    if (cart.lines.length > 0 && !cart.rental) {
      const ok = confirm(`Keranjang POS sedang berisi ${cart.lines.length} item. Memulai sewa akan MENGOSONGKAN keranjang itu. Lanjutkan?`);
      if (!ok) return;
    }
    if (cart.rental && !initial) {
      const ok = confirm(
        `Keranjang POS sedang berisi sewa ${cart.rental.customerName} (${cart.rental.lines.length} barang) yang belum dibayar. Ganti dengan sewa baru ini?`
      );
      if (!ok) return;
    }
    setErr(null);
    // E18: bawa draft ke keranjang POS; pembayaran di /pos lewat modal pembayaran yang sama
    const started = cart.startRental(draft, lines.map((l) => ({ product: l.product, variant: l.variant })));
    if (!started) { setErr("Gagal memasukkan sewa ke keranjang — muat ulang data produk lalu coba lagi."); return; }
    onClose();
    router.push("/pos");
  }

  const title = view === "pick" ? "Pilih barang sewa" : view === "edit" ? "Atur barang sewa" : initial ? "Ubah sewa" : "Sewa baru";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col rounded-t-4xl bg-white p-5 shadow-soft-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {view !== "list" && lines.length > 0 && (
              <button
                onClick={() => { setEditor(null); setView("list"); }}
                className="shrink-0 text-xs font-semibold text-violet underline"
              >
                Kembali
              </button>
            )}
            <h3 className="truncate text-lg font-bold text-ink">{title}</h3>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-gray-600" aria-label="Tutup">
            <Icon name="close" size={16} />
          </button>
        </div>

        {view === "pick" && (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input mb-3"
              placeholder="Cari barang / seri / ukuran / warna…"
              autoFocus
            />
            <div className="min-h-0 flex-1 space-y-2 overflow-auto pretty-scroll">
              {rentable.length === 0 && (
                <p className="rounded-2xl bg-beige/60 px-3 py-4 text-center text-sm text-gray-600">
                  {q ? "Tidak ada barang yang cocok." : "Tidak ada barang bertok dengan harga jual terisi. Cek Produk / Inventori."}
                </p>
              )}
              {rentable.map((p) => {
                const inList = lines.some((l) => l.variant.id === p.variant.id);
                const left = p.product.stock - reserved(p.product.id);
                return (
                  <button
                    key={p.variant.id}
                    onClick={() => choose(p)}
                    disabled={left <= 0 && !inList}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-beige/60 p-3 text-left transition hover:bg-beige disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">
                        {p.product.name}
                        {inList && <span className="ml-1.5 rounded-full bg-violet/15 px-1.5 py-0.5 text-[10px] font-bold text-violet">DI DAFTAR</span>}
                      </div>
                      <div className="truncate text-xs text-gray-600">{variantLabel(p.variant)}</div>
                      <div className="text-xs text-gray-600">
                        stok {p.product.stock}
                        {left !== p.product.stock ? ` (sisa ${Math.max(0, left)})` : ""} · {p.variant.rentalDays ?? 3} hari
                        {p.variant.depositPrice ? ` · deposit ${formatRupiah(p.variant.depositPrice)}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tnum text-sm font-bold text-olive">{formatRupiah(p.price)}</div>
                      <div className="text-[10px] text-gray-500">/unit</div>
                      {p.isDefault && <div className="text-[10px] font-semibold text-warning">default {DEFAULT_RENTAL_PCT}%</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {view === "edit" && editor && (
          <div className="min-h-0 flex-1 overflow-auto pretty-scroll">
            <div className="mb-3 flex items-start justify-between gap-2 rounded-2xl bg-beige/60 p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{editor.product.name}</div>
                <div className="truncate text-xs text-gray-600">
                  {variantLabel(editor.variant)} · stok {editor.product.stock}
                  {reserved(editor.product.id, editor.index) > 0 ? ` (${reserved(editor.product.id, editor.index)} sudah di daftar)` : ""}
                </div>
              </div>
              {editor.index === null && (
                <button onClick={() => setView("pick")} className="shrink-0 text-xs font-semibold text-violet underline">Ganti</button>
              )}
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Jumlah</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, editor.product.stock - reserved(editor.product.id, editor.index))}
                  value={editor.qty}
                  onChange={(e) => setEditor({ ...editor, qty: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
                  className="input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Deposit per unit (Rp)</span>
                <input
                  type="number"
                  min={0}
                  value={editor.deposit || ""}
                  onChange={(e) => setEditor({ ...editor, deposit: Math.max(0, Number(e.target.value) || 0) })}
                  className="input"
                  placeholder="0"
                  aria-label="Deposit per unit"
                />
              </label>
            </div>

            <div className="mb-3 rounded-2xl bg-beige/40 p-3">
              <label className="mb-1 block text-sm text-olive">Harga sewa per unit (Rp)</label>
              <input
                type="number"
                min={500}
                value={editor.rentPrice || ""}
                onChange={(e) => setEditor({ ...editor, rentPrice: Math.max(0, Number(e.target.value) || 0) })}
                className="input mb-2"
                aria-label="Harga sewa per unit"
              />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-medium text-olive">dari harga jual {formatRupiah(editor.variant.sellingPrice)}:</span>
                {RENTAL_PCT_OPTIONS.map((pct) => {
                  const v = rentalPriceFromPct(editor.variant.sellingPrice, pct);
                  const active = v != null && v === editor.rentPrice;
                  return (
                    <button
                      key={pct}
                      type="button"
                      disabled={v == null}
                      aria-pressed={active}
                      onClick={() => v != null && setEditor({ ...editor, rentPrice: v })}
                      className={`rounded-full px-2.5 py-1 font-semibold transition disabled:opacity-40 ${active ? "bg-violet text-white" : "bg-black/5 text-ink hover:bg-black/10"}`}
                    >
                      {pct}%
                    </button>
                  );
                })}
                {!editor.isDefault && editor.price !== editor.rentPrice && (
                  <button type="button" onClick={() => setEditor({ ...editor, rentPrice: editor.price })} className="rounded-full px-2.5 py-1 text-violet hover:bg-violet/10">
                    Harga produk ({formatRupiah(editor.price)})
                  </button>
                )}
              </div>
              {editor.isDefault && (
                <p className="mt-1.5 text-[11px] text-warning">
                  Harga sewa produk ini belum diatur — memakai default {DEFAULT_RENTAL_PCT}% dari harga jual. Ubah di sini atau atur permanen di Produk → Edit.
                </p>
              )}
            </div>

            <div className="mb-3 flex justify-between rounded-2xl bg-violet/5 px-3 py-2 text-sm">
              <span className="text-olive">{editor.qty} × {formatRupiah(editor.rentPrice)}</span>
              <b className="tnum text-ink">{formatRupiah(rentTotal(editor.rentPrice, editor.qty))}</b>
            </div>
            {editErr && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{editErr}</p>}
            <button onClick={commitEditor} className="btn-violet w-full py-3">
              {editor.index === null ? "Tambah ke daftar" : "Simpan perubahan"}
            </button>
          </div>
        )}

        {view === "list" && (
          <div className="min-h-0 flex-1 overflow-auto pretty-scroll">
            {prefill.missing > 0 && (
              <p className="mb-3 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                {prefill.missing} barang dari sewa di keranjang tidak ditemukan lagi di data produk — dilewati. Periksa daftar di bawah.
              </p>
            )}

            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-olive">Barang disewa ({lines.length})</span>
            </div>
            <ul className="mb-2 space-y-2">
              {lines.length === 0 && (
                <li className="rounded-2xl bg-beige/60 px-3 py-3 text-center text-sm text-gray-600">Belum ada barang. Tambahkan minimal satu.</li>
              )}
              {lines.map((l, i) => (
                <li key={l.variant.id} className="flex items-start justify-between gap-2 rounded-2xl bg-beige/60 p-3 text-sm">
                  <button onClick={() => editLine(i)} className="min-w-0 flex-1 text-left" aria-label={`Ubah ${l.product.name}`}>
                    <div className="truncate font-semibold text-ink">{l.product.name}</div>
                    <div className="truncate text-xs text-gray-600">{variantLabel(l.variant)}</div>
                    <div className="text-xs text-gray-600">
                      {l.qty} × {formatRupiah(l.rentPrice)}
                      {l.deposit > 0 ? ` · deposit ${formatRupiah(l.deposit)}/unit` : ""}
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <b className="tnum text-ink">{formatRupiah(rentTotal(l.rentPrice, l.qty))}</b>
                    <button onClick={() => removeLine(i)} className="text-xs font-semibold text-danger underline" aria-label={`Hapus ${l.product.name}`}>
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setQ(""); setView("pick"); }}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-black/15 py-2.5 text-sm font-semibold text-olive transition hover:border-violet hover:text-violet"
            >
              <Icon name="plus" size={16} /> Tambah barang
            </button>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Lama sewa (hari)</span>
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => { setDaysTouched(true); setDays(Math.max(1, Math.round(Number(e.target.value)) || 1)); }}
                  className="input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-olive">Tanggal mulai</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || todayIso())} className="input" />
              </label>
              <div className="col-span-2 text-sm">
                <span className="mb-1 block text-olive">Harus kembali (semua barang)</span>
                <div className="rounded-2xl bg-beige/60 px-3 py-2.5 font-semibold text-ink">{formatDateId(due)}</div>
              </div>
            </div>

            <label className="mb-1 block text-sm text-olive">Nama penyewa</label>
            <input
              value={name}
              list="rental-customers"
              onChange={(e) => {
                setName(e.target.value);
                const c = customers.find((x) => x.name === e.target.value);
                if (c?.phone) setPhone(c.phone);
              }}
              className="input mb-2"
              placeholder="wajib"
            />
            <datalist id="rental-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <label className="mb-1 block text-sm text-olive">No. HP / WhatsApp</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input mb-3" inputMode="tel" placeholder="08xx… (untuk pengingat)" />

            <div className="mb-3 space-y-1 rounded-2xl bg-violet/5 px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="text-olive">Biaya sewa ({lines.length} barang · {units} unit)</span><b className="tnum text-ink">{formatRupiah(total)}</b></div>
              {depositTotal > 0 && (
                <div className="flex justify-between text-xs text-gray-600"><span>Deposit ditahan — dicatat di buku</span><span className="tnum">{formatRupiah(depositTotal)}</span></div>
              )}
              <div className="flex justify-between text-xs text-gray-600"><span>Pembayaran</span><span>di kasir (POS): QRIS / tunai / transfer</span></div>
            </div>
            {err && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
            <button onClick={submit} disabled={lines.length === 0} className="btn-violet w-full py-3 disabled:opacity-50">
              {initial ? `Simpan & lanjut bayar — ${formatRupiah(total)}` : `Mulai sewa — ${formatRupiah(total)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
