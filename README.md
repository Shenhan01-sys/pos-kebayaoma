# Kebaya Oma POS

POS (Point of Sale) tablet untuk toko fashion / kebaya di Indonesia.
Dibangun dengan **Next.js 16 (App Router) + TypeScript + Tailwind CSS + Zustand + Supabase**.

## Fitur

- Kasir POS: katalog, keranjang, varian (ukuran/warna), checkout QRIS/Tunai/Transfer, diskon, pajak (harga sudah termasuk PPN), struk 58mm (printer thermal RPP02N) + print.
- **Sewa** (`/sewa`): sewa baru (bayar lewat modal pembayaran POS: QRIS/tunai/transfer), daftar Aktif/Hari ini/Terlambat/Selesai, terima barang sebagian, pengingat WhatsApp. Harga sewa bisa diatur per varian (pilihan 50-90% dari harga jual di form produk); bila belum diatur, default 70% dari harga jual.
- Manajemen Produk CRUD + editor varian, kategori. **SKU/barcode otomatis** (8 digit angka, unik; tidak diisi manual).
- Inventori & Stok: restock, penyesuaian, riwayat pergerakan, transfer stok antar-toko.
- **Petty Cash** (`/expenses`): pencatatan pengeluaran kas kecil per toko, foto bukti opsional.
- Pelanggan & Staff (PIN via Supabase Auth). **RBAC 4 role**: superadmin / manager / admin / kasir (`lib/roles.ts`), akses menu & aksi dibatasi per role.
- **Multi-toko** (MJL / KTB): data per toko, switcher toko (Semua / per toko) untuk role lintas-toko, koordinat toko + geofence login di Pengaturan.
- Transaksi, Shift (buka/tutup + selisih), Laporan (export CSV).
- Label QR/Barcode per produk → profil publik; **cetak label thermal TSPL** (XP-D4601B / XP-420B, label 33x15mm, 3 per baris) lewat `print-bridge` lokal; verifikasi pembayaran via QR di struk.
- Scan barcode kamera (`html5-qrcode`) di POS.
- PWA: manifest + service worker, bisa install dan jalan offline (shell cache).
- **Fallback demo mode**: kalau Supabase belum dikonfigurasi, aplikasi berjalan dengan data dummy + localStorage.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **State:** Zustand (persist)
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage)
- **QR/Barcode:** `qrcode.react`, `jsbarcode`, `html5-qrcode`
- **Chart:** ECharts 6
- **PDF/Print:** `jspdf`, `html2canvas` (PDF = pratinjau label), `window.print()` (struk 58mm); label thermal langsung via **TSPL print-bridge** (`scripts/print-bridge.mjs`, XP-D4601B)
- **Test:** Vitest (`npm run test:unit`, 150 tes)

## Setup Lokal

```bash
npm install
copy .env.local.example .env.local   # isi variabel Supabase & QRIS
npm run dev
```

Script lain:

```bash
npm run test:unit      # vitest (150 tes unit)
npm run print-bridge   # jembatan lokal ke printer label TSPL (jalankan di PC yang terhubung ke printer)
```

> Cetak label (tombol **Direct Print**) hanya bisa dari browser di PC yang menjalankan `print-bridge` (default `127.0.0.1:9100`, printer `Xprinter XP-D4601B`, bisa diubah lewat env `PRINT_BRIDGE_PORT` / `PRINTER_NAME` / `BRIDGE_ORIGINS`). Di Chrome, izinkan akses jaringan lokal (Local Network Access) untuk situs POS saat diminta.

### Variabel Lingkungan (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STORE_ID=

# Pilih gateway QRIS: midtrans (default) atau gopay
QRIS_GATEWAY=midtrans
MIDTRANS_SERVER_KEY=
GOPAY_MERCHANT_KEY=
```

Kalau variabel Supabase dikosongkan, aplikasi otomatis masuk **mode demo** (data dummy, tanpa login).

### Setup Database

1. Jalankan file SQL di `supabase/migrations/` secara berurutan di Supabase SQL Editor.
2. Buat staff & auth user:
   ```bash
   node scripts/setup-auth-staff.js
   ```
3. Seed data katalog awal:
   ```bash
   node scripts/seed-full.js
   # atau
   npx ts-node scripts/seed.ts
   ```

## Deploy (Vercel)

Repo ini siap di-import ke Vercel sebagai project Next.js.

```bash
npm run build
npm run start   # atau npm run dev
```

## Struktur Penting

```
Opencode/
├── app/                  # App Router pages
├── components/           # Reusable UI & modals
├── store/                # Zustand stores (auth, cart, data, settings)
├── lib/                  # Types, Supabase client, dummy data
├── scripts/              # Seed, staff setup, print-bridge (TSPL)
├── supabase/migrations/  # SQL schema + RLS
├── public/               # PWA manifest, service worker, icons
├── FITUR.md              # Daftar fitur lengkap
└── plan-opencode.md      # Arsitektur & roadmap
```

## Roadmap

Lihat `plan-opencode.md` untuk rencana panjang:

- Integrasi QRIS production-ready (Midtrans/Xendit webhook)
- Offline sync penuh (PowerSync; skema & client sudah ada, belum jadi jalur utama)
- Print struk native ESC/POS (Capacitor/native bridge) — saat ini struk lewat print browser 58mm (RPP02N)
- Loyalty, promo, e-Faktur

## Dokumentasi Lengkap

- `POSkebaya-Vault/` — Obsidian knowledge vault (arsitektur, database, modul, backlog)
- `research/` — hasil riset teknis
- `QnA/` — catatan kebutuhan bisnis
