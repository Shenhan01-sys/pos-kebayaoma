# Daftar Fitur — POS Kebaya Oma

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS + Zustand + Supabase.

Aplikasi POS tablet untuk toko fashion/kebaya di Indonesia. Dua mode jalannya:

1. **Supabase Mode** — data tersimpan di Postgres, Auth PIN staff, realtime sinkron antar-device.
2. **Demo/Fallback Mode** — kalau env Supabase belum di-set, aplikasi otomatis berjalan dengan data dummy & localStorage (tanpa login).

Palette: Beige `#F2F5E2`, Vanilla Custard `#E3DEA4`, Golden Apricot `#D4954D`, Olive Wood `#775533`, Midnight Violet `#290024`.

---

## A. Shell & Tema
- [x] Sidebar tablet: Dashboard, Kasir POS, Sewa, Produk, Inventori, Pelanggan, Petty Cash (`/expenses`), Staff, Transaksi, Shift, Laporan, Pengaturan — menu yang tampil difilter per role (lihat bagian H)
- [x] Switcher toko (Semua / MJL / KTB) di sidebar untuk role lintas-toko
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
- [x] Diskon + **Pajak inclusive** (harga sudah termasuk PPN; PPN tersirat dihitung dari tarif % di Pengaturan dan ditampilkan "Sudah termasuk PPN" di struk)
- [x] Tunai: uang diterima + kembalian otomatis + validasi uang kurang
- [x] QRIS:
  - [x] Generate QRIS dinamis via `/api/qris/charge` (Midtrans / GoPay / mock)
  - [x] Mode simulasi bayar (tanpa API key)
  - [x] Mode real: buat transaksi **pending**, tunggu webhook/realtime, auto-finalisasi saat lunas
- [x] Struk + QR verifikasi digital + Print via browser (kertas 58mm, printer thermal RPP02N)
- [x] **Otomatis kurangi stok** via log pergerakan (sale)
- [x] **Auto-update statistik pelanggan** saat transaksi lunas

## D. Manajemen Produk (`/products`) — CRUD lengkap
- [x] List + filter kategori + badge Nonaktif
- [x] **Tambah / Edit produk** (nama, kategori, brand, season, bahan, perawatan, tags, deskripsi, harga coret). **SKU otomatis** (8 digit angka, unik) dibuat saat simpan; tidak ada input SKU manual, saat edit tampil read-only
- [x] **Editor Varian**: ukuran, warna, barcode, modal, harga, stok — add/remove (SKU varian otomatis, tampil read-only)
- [x] **Harga Sewa** per varian: pilihan cepat 50 / 60 / 70 / 80 / 90% dari harga jual (chips) atau isi manual
- [x] **Hapus produk** (konfirmasi)
- [x] Toggle aktif/nonaktif
- [x] **Label QR & Barcode** per produk/varian -> profil publik + cetak label
  - [x] Label thermal **TSPL** untuk printer XP-D4601B / XP-420B: label die-cut 33x15mm, 3 label per baris (liner 108mm), jumlah baris tepat tanpa label kosong
  - [x] Tombol **Direct Print** mengirim job TSPL lewat `print-bridge` lokal (`npm run print-bridge`, default `127.0.0.1:9100`); hanya bisa dari browser di PC yang menjalankan bridge dan terhubung ke printer
  - [x] Chrome meminta izin **Local Network Access** untuk situs POS (pilih Izinkan; bila pernah diblokir: Setelan situs → Akses jaringan lokal)
  - [x] Barcode adaptif (modul 1-3 dot, Code128) agar mudah di-scan; teks nama/harga digambar sebagai bitmap
  - [x] Tombol PDF = pratinjau; ukuran lain (40x20 RPP02N, 50x25, 60x30) tetap tersedia lewat jalur browser/PDF

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
- [x] **RBAC 4 role**: superadmin / manager / admin / kasir (`lib/roles.ts`), akses halaman:
  - superadmin: semua halaman (termasuk Staff, Pengaturan, Petty Cash; satu-satunya yang melihat laba/HPP)
  - manager: Dashboard, Kasir POS, Sewa, Produk, Inventori, Pelanggan, Transaksi, Shift, Laporan
  - admin: Dashboard, Transaksi, Petty Cash, Laporan
  - kasir: Dashboard, Kasir POS, Sewa, Inventori, Pelanggan, Transaksi, Shift
  - Restock/penyesuaian stok & batal/refund transaksi: superadmin + manager; CRUD staff: superadmin; guard anti self-delete di API
- [x] PIN login via Supabase Auth, telepon, status aktif/nonaktif
- [x] Multi-toko: superadmin/manager/admin lintas-toko (switcher Semua/MJL/KTB), kasir terikat satu toko

## I. Transaksi (`/transactions`)
- [x] Tabel semua transaksi + pencarian
- [x] **Batalkan / Refund** (update status, kembalikan stok, kurangi statistik pelanggan)
- [x] Link ke Verifikasi
- [x] Badge **Sewa** pada transaksi sewa (dikelola di menu Sewa)
- [x] Panel riwayat transfer stok antar-toko

## I2. Sewa (`/sewa`)
- [x] Menu Sewa untuk superadmin / manager / kasir
- [x] Ringkasan di atas daftar (jumlah terlambat, deposit ditahan di buku, dll.)
- [x] Tab **Aktif / Hari ini / Terlambat / Selesai** + pencarian (penyewa, HP, nota, barang)
- [x] **Sewa baru**: semua varian bertok bisa disewa; bila varian belum punya Harga Sewa, default **70% dari harga jual** (bisa diubah di form; chips 50-90%). Tombol **Mulai sewa** memindahkan ke **/pos**: popup konfirmasi sewa muncul otomatis, lalu **pembayaran memakai modal yang sama dengan penjualan** (QRIS / tunai / transfer + foto bukti wajib). Keranjang sewa terkunci (satu baris sewa, tanpa diskon/nego/pre-order); penyewa dibuat otomatis; stok berkurang saat nota lunas; butuh koneksi internet
- [x] **Batalkan sewa** dari popup/keranjang POS: tidak ada nota yang terbentuk
- [x] **Terima barang** (boleh sebagian); stok masuk kembali saat tombol ditekan, bukan otomatis saat jatuh tempo lewat
- [x] Tombol **WhatsApp** untuk pengingat jatuh tempo/keterlambatan (manual, buka wa.me)
- [x] Deposit per unit hanya info/pencatatan di buku (bukan modul kas; pengembalian deposit belum dicatat sistem)
- [x] Tanpa denda keterlambatan

## I3. Petty Cash (`/expenses`)
- [x] Catat pengeluaran kas kecil per toko (tanggal, kategori, nominal, catatan), langsung tanpa approval
- [x] Foto bukti opsional (dikompres di browser)
- [x] Filter rentang tanggal + ringkasan per kategori
- [x] Akses: admin + superadmin

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
- [x] Nama toko, alamat, telepon, kasir, **pajak %** (harga sudah termasuk pajak), printer
- [x] Koordinat GPS toko (peta) untuk geofence login 25 m — superadmin saja, tersimpan di DB
- [x] Persist localStorage

## O. Struk / Receipt
- [x] Format kertas 58mm (area cetak ~48mm, printer thermal RPP02N), info toko dinamis, item, diskon, **PPN (sudah termasuk)**, total, bayar, kembali
- [x] Ticket notch cutout
- [x] QR digital receipt; print via print browser (`window.print()`); print native ESC/POS belum diimplementasi

## P. Arsitektur
- [x] Next.js 16 App Router + TS, Tailwind (palette kustom)
- [x] Zustand: cart, data (products/categories/customers/staff/movements/shifts persist), settings persist
- [x] Supabase: Auth, Postgres, RLS, Realtime
- [x] qrcode.react + jsbarcode untuk generate QR/barcode
- [x] 16 halaman (`app/**/page.tsx`) + 4 API route (`app/api/**/route.ts`: qris charge/status/webhook, staff)
- [x] Unit test Vitest (`npm run test:unit`, 150 tes); `npm run print-bridge` untuk printer label TSPL
- [x] Multi-store (MJL / KTB): data per toko + transfer stok antar-toko
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
- Print struk native ESC/POS via Capacitor / Bluetooth print service (struk saat ini lewat print browser 58mm; label thermal sudah lewat print-bridge TSPL)
- PO / Supplier, Loyalty points, Promosi terjadwal, Gift card, e-Faktur/Coretax

## Setup
1. Salin `.env.local.example` → `.env.local` dan isi Supabase + QRIS key.
2. Jalankan migrasi SQL di `supabase/migrations/` di Supabase SQL Editor.
3. Jalankan `node scripts/setup-auth-staff.js` untuk membuat staff & auth user.
4. Jalankan `node scripts/seed-full.js` (atau `npx ts-node scripts/seed.ts`) untuk data awal.
5. `npm run build` dan deploy ke Vercel.
6. (Opsional, cetak label) di PC yang terhubung ke printer: `npm run print-bridge`.

## Referensi riset
- `plan-opencode.md` — draf arsitektur & roadmap
- `POSkebaya-Vault/` — dokumentasi lengkap (Obsidian vault)
- `research/` — hasil riset QRIS, PWA vs native, thermal print, Supabase
- `QnA/` — catatan wawancara dengan pemilik bisnis
