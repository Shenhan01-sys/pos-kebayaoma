# Daftar Fitur FE — POS Kebaya Oma (Dummy / Tanpa Backend)

Next.js 14 (App Router) + TypeScript + Tailwind + Zustand + qrcode.react.
Semua data **dummy**; CRUD persist di **localStorage** (via Zustand persist) supaya
tetap ada saat reload. Belum terhubung Supabase / payment gateway sungguhan.

Palette: Beige `#F2F5E2`, Vanilla Custard `#E3DEA4`, Golden Apricot `#D4954D`,
Olive Wood `#775533`, Midnight Violet `#290024`.

## A. Shell & Tema
- [x] Sidebar tablet: Dashboard, Kasir POS, Produk, Inventori, Pelanggan, Staff, Transaksi, Shift, Laporan, Pengaturan
- [x] Palette kustom (violet sidebar, aksen apricot/olive)
- [x] Nama toko dinamis dari Pengaturan

## B. Dashboard (`/`)
- [x] KPI: Penjualan, Transaksi, Stok Menipis, Buka Kasir
- [x] Grafik pembayaran per metode (QRIS/Tunai/Transfer)
- [x] Grafik Produk Terlaris
- [x] Daftar Stok Menipis (live dari data store)
- [x] Transaksi Terakhir (reflect batal/refund)

## C. Kasir POS (`/pos`)
- [x] Grid katalog + filter kategori + pencarian (nama/SKU/tag)
- [x] Pemilih varian (ukuran/warna) dgn stok; disable bila habis
- [x] Keranjang: qty, hapus (Zustand)
- [x] Pilih pelanggan
- [x] Checkout: QRIS / Tunai / Transfer
- [x] Diskon + **Pajak (VAT 12% dari Pengaturan)**
- [x] Tunai: uang diterima + kembalian otomatis
- [x] QRIS: QR dummy + simulasi bayar
- [x] Struk + QR verifikasi digital + Print (browser)
- [x] **Otomatis kurangi stok** via log pergerakan (sale)

## D. Manajemen Produk (`/products`) — CRUD lengkap
- [x] List + filter kategori + badge Nonaktif
- [x] **Tambah / Edit produk** (nama, SKU, kategori, brand, season, bahan, perawatan, tags, deskripsi, harga coret)
- [x] **Editor Varian**: ukuran, warna, SKU, barcode, modal, harga, stok — add/remove
- [x] **Hapus produk** (konfirmasi)
- [x] Toggle aktif/nonaktif
- [x] **Label QR** per produk -> profil publik

## E. Kategori (modal di Produk)
- [x] Tambah / Edit / Hapus kategori (nama + slug)

## F. Inventori & Stok (`/inventory`)
- [x] Tabel semua varian: stok, modal, harga, badge stok menipis/habis
- [x] **Restock / Penyesuaian stok** (delta + alasan + catatan) -> update stok
- [x] **Riwayat pergerakan stok** (sale/restock/adjustment/return) dgn staff & alasan
- [x] Filter stok menipis (≤5)

## G. Pelanggan (`/customers`) — CRUD
- [x] Tambah / Edit / Hapus pelanggan
- [x] Total belanja & jumlah transaksi (live)
- [x] **Riwayat transaksi** per pelanggan

## H. Staff & Peran (`/staff`) — CRUD
- [x] Tambah / Edit / Hapus staff
- [x] Role: Admin / Manager / Kasir
- [x] PIN login, telepon, status aktif/nonaktif

## I. Transaksi (`/transactions`)
- [x] Tabel semua transaksi + pencarian
- [x] **Batalkan / Refund** (update status, reflect ke Dashboard & Verify)
- [x] Link ke Verifikasi

## J. Shift (`/shifts`)
- [x] Info shift, kas diharapkan, tutup shift (dummy)

## K. Laporan (`/reports`)
- [x] Filter tanggal (from–to)
- [x] KPI: Total penjualan, transaksi, rata-rata, pajak
- [x] Per metode pembayaran (bar)
- [x] Diskon diberikan
- [x] Penjualan per produk (qty + revenue, bar)
- [x] **Export CSV** laporan penjualan

## L. Verifikasi Pembayaran (`/verify/[id]`)
- [x] Cek status paid/pending, detail item, reflect batal/refund

## M. Profil Produk Publik (`/product/[sku]`)
- [x] Galeri, tag, bahan, perawatan, varian & harga, "Tambah ke Kasir"
- [x] Target scan label QR

## N. Pengaturan (`/settings`)
- [x] Nama toko, alamat, telepon, kasir, **pajak %**, printer
- [x] Persist localStorage

## O. Struk / Receipt
- [x] Format 80mm, info toko dinamis, item, diskon, **pajak**, total, bayar, kembali
- [x] QR digital receipt; print via `window.print()`

## P. Arsitektur
- [x] Next.js 14 App Router + TS, Tailwind (palette kustom)
- [x] Zustand: cart, data (products/categories/customers/staff/movements persist), settings persist
- [x] qrcode.react untuk generate QR
- [x] Build production sukses (13 routes)

## Q. PWA (installable + offline)
- [x] `manifest.json` (standalone, landscape, icon SVG)
- [x] Service worker `sw.js` (network-first + cache fallback untuk navigasi & aset)
- [x] Register SW otomatis di production (RegisterSW)
- [x] Meta apple-touch-icon / theme-color
- [x] Bisa di-install ("Add to Home Screen") & buka offline (shell tercache)

## Belum diimplementasikan (butuh backend/native — lih. plan-opencode.md)
- Integrasi Xendit/Midtrans sungguhan (webhook)
- Supabase (DB, Auth, RLS, Realtime, Storage)
- Offline sync (PowerSync/RxDB)
- Print native ESC/POS via Capacitor / Bluetooth print service
- Scan kamera (html5-qrcode) di dalam app
- PO / Supplier, Loyalty points, Promosi terjadwal, Multi-store, Gift card, e-Faktur/Coretax

## Referensi riset
- `research_posfeatures.json` — hasil DeepResearch fitur POS production-ready (P0/P1/P2)
- `plan-opencode.md` — draf arsitektur & roadmap
