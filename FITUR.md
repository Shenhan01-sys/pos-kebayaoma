# Daftar Fitur — POS Kebaya Oma

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS + Zustand + Supabase.

Aplikasi POS tablet untuk toko fashion/kebaya di Indonesia. Dua mode jalannya:

1. **Supabase Mode** — data tersimpan di Postgres, Auth PIN staff, realtime sinkron antar-device.
2. **Demo/Fallback Mode** — kalau env Supabase belum di-set, aplikasi otomatis berjalan dengan data dummy & localStorage (tanpa login).

Palette: Beige `#F2F5E2`, Vanilla Custard `#E3DEA4`, Golden Apricot `#D4954D`, Olive Wood `#775533`, Midnight Violet `#290024`.

---

## A. Shell & Tema
- [x] Sidebar tablet: Dashboard, Kasir POS, Produk, Inventori, Pelanggan, Staff, Transaksi, Shift, Laporan, Pengaturan
- [x] Palette kustom solid (violet sidebar, aksen apricot/olive)
- [x] Nama toko dinamis dari Pengaturan
- [x] Badge stok menipis di sidebar

## B. Dashboard (`/`)
- [x] Hero greeting + info toko
- [x] KPI: Penjualan, Transaksi, Stok Menipis, Buka Kasir
- [x] Grafik donut pembayaran per metode (QRIS/Tunai/Transfer)
- [x] Grafik Produk Terlaris
- [x] Daftar Stok Menipis (live dari data store)
- [x] Transaksi Terakhir (reflect batal/refund/pending)

## C. Kasir POS (`/pos`)
- [x] Grid katalog + filter kategori + pencarian (nama/SKU/tag)
- [x] Scan barcode kamera (`html5-qrcode`)
- [x] Pemilih varian (ukuran/warna) dgn stok; disable bila habis
- [x] Keranjang: qty, hapus (Zustand)
- [x] Pilih pelanggan
- [x] Checkout: QRIS / Tunai / Transfer
- [x] Diskon + **Pajak (VAT % dari Pengaturan)**
- [x] Tunai: uang diterima + kembalian otomatis + validasi uang kurang
- [x] QRIS:
  - [x] Generate QRIS dinamis via `/api/qris/charge` (Midtrans / GoPay / mock)
  - [x] Mode simulasi bayar (tanpa API key)
  - [x] Mode real: buat transaksi **pending**, tunggu webhook/realtime, auto-finalisasi saat lunas
- [x] Struk + QR verifikasi digital + Print (browser)
- [x] **Otomatis kurangi stok** via log pergerakan (sale)
- [x] **Auto-update statistik pelanggan** saat transaksi lunas

## D. Manajemen Produk (`/products`) — CRUD lengkap
- [x] List + filter kategori + badge Nonaktif
- [x] **Tambah / Edit produk** (nama, SKU, kategori, brand, season, bahan, perawatan, tags, deskripsi, harga coret)
- [x] **Editor Varian**: ukuran, warna, SKU, barcode, modal, harga, stok — add/remove
- [x] **Hapus produk** (konfirmasi)
- [x] Toggle aktif/nonaktif
- [x] **Label QR & Barcode** per produk/varian -> profil publik + cetak label

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
- [x] PIN login via Supabase Auth, telepon, status aktif/nonaktif

## I. Transaksi (`/transactions`)
- [x] Tabel semua transaksi + pencarian
- [x] **Batalkan / Refund** (update status, kembalikan stok, kurangi statistik pelanggan)
- [x] Link ke Verifikasi

## J. Shift (`/shifts`)
- [x] Buka shift (modal awal)
- [x] Hitung total transaksi, penjualan, QRIS, tunai secara real-time
- [x] Tutup shift dengan input uang fisik + hitung selisih
- [x] Riwayat shift

## K. Laporan (`/reports`)
- [x] Filter tanggal (from–to)
- [x] KPI: Total penjualan, transaksi, rata-rata, pajak, diskon
- [x] Donut per metode pembayaran
- [x] Tren penjualan harian
- [x] Penjualan per produk (qty + revenue, bar chart + tabel)
- [x] **Export CSV** laporan penjualan

## L. Verifikasi Pembayaran (`/verify/[id]`)
- [x] Cek status paid/pending/cancelled/refunded, detail item, total
- [x] QR digital receipt

## M. Profil Produk Publik (`/product/[sku]`)
- [x] Galeri, tag, bahan, perawatan, varian & harga, "Tambah ke Kasir"
- [x] Target scan label QR

## N. Pengaturan (`/settings`)
- [x] Nama toko, alamat, telepon, kasir, **pajak %**, printer
- [x] Persist localStorage

## O. Struk / Receipt
- [x] Format 80mm, info toko dinamis, item, diskon, **pajak**, total, bayar, kembali
- [x] Ticket notch cutout
- [x] QR digital receipt; print via `window.print()`

## P. Arsitektur
- [x] Next.js 16 App Router + TS, Tailwind (palette kustom)
- [x] Zustand: cart, data (products/categories/customers/staff/movements/shifts persist), settings persist
- [x] Supabase: Auth, Postgres, RLS, Realtime
- [x] qrcode.react + jsbarcode untuk generate QR/barcode
- [x] Build production sukses (16 routes)
- [x] Fallback demo mode tanpa Supabase

## Q. PWA (installable + offline)
- [x] `manifest.json` (standalone, landscape, icon SVG)
- [x] Service worker `sw.js` (network-first + cache fallback untuk navigasi & aset)
- [x] Register SW otomatis di production (RegisterSW)
- [x] Meta apple-touch-icon / theme-color
- [x] Bisa di-install ("Add to Home Screen") & buka offline (shell tercache)

## R. Responsive Layout (portrait + landscape)
- [x] Manifest `orientation: "any"` → bisa portrait & landscape
- [x] Sidebar statis di tablet/desktop (≥md), drawer + hamburger di layar kecil
- [x] Kasir POS: berdampingan di layar lebar (≥lg), bertumpuk di layar kecil (portrait)
- [x] Grid & tabel responsif (sm/md/lg/xl), overflow aman, kartu `truncate`
- [x] Modal & struk `max-w-full` muat di semua viewport & orientasi

## Belum diimplementasikan (lih. plan-opencode.md)
- QRIS real end-to-end teruji di production (scaffold API + webhook sudah ada)
- Offline sync robust (PowerSync/RxDB)
- Print native ESC/POS via Capacitor / Bluetooth print service
- PO / Supplier, Loyalty points, Promosi terjadwal, Multi-store, Gift card, e-Faktur/Coretax

## Setup
1. Salin `.env.local.example` → `.env.local` dan isi Supabase + QRIS key.
2. Jalankan migrasi SQL di `supabase/migrations/` di Supabase SQL Editor.
3. Jalankan `node scripts/setup-auth-staff.js` untuk membuat staff & auth user.
4. Jalankan `node scripts/seed-full.js` (atau `npx ts-node scripts/seed.ts`) untuk data awal.
5. `npm run build` dan deploy ke Vercel.

## Referensi riset
- `plan-opencode.md` — draf arsitektur & roadmap
- `POSkebaya-Vault/` — dokumentasi lengkap (Obsidian vault)
- `research/` — hasil riset QRIS, PWA vs native, thermal print, Supabase
- `QnA/` — catatan wawancara dengan pemilik bisnis
