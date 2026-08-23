# Kebaya Oma POS

POS (Point of Sale) tablet untuk toko fashion / kebaya di Indonesia.
Dibangun dengan **Next.js 16 (App Router) + TypeScript + Tailwind CSS + Zustand + Supabase**.

## Fitur

- Kasir POS: katalog, keranjang, varian (ukuran/warna), checkout QRIS/Tunai/Transfer, diskon, pajak (VAT %), struk + print.
- Manajemen Produk CRUD + editor varian, kategori.
- Inventori & Stok: restock, penyesuaian, riwayat pergerakan.
- Pelanggan & Staff (role + PIN via Supabase Auth).
- Transaksi, Shift (buka/tutup + selisih), Laporan (export CSV).
- Label QR/Barcode per produk → profil publik; verifikasi pembayaran via QR di struk.
- Scan barcode kamera (`html5-qrcode`) di POS.
- PWA: manifest + service worker, bisa install dan jalan offline (shell cache).
- **Fallback demo mode**: kalau Supabase belum dikonfigurasi, aplikasi berjalan dengan data dummy + localStorage.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **State:** Zustand (persist)
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage)
- **QR/Barcode:** `qrcode.react`, `jsbarcode`, `html5-qrcode`
- **Chart:** ECharts 6
- **PDF/Print:** `jspdf`, `html2canvas`, `window.print()`

## Setup Lokal

```bash
npm install
copy .env.local.example .env.local   # isi variabel Supabase & QRIS
npm run dev
```

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
├── scripts/              # Seed & staff setup
├── supabase/migrations/  # SQL schema + RLS
├── public/               # PWA manifest, service worker, icons
├── FITUR.md              # Daftar fitur lengkap
└── plan-opencode.md      # Arsitektur & roadmap
```

## Roadmap

Lihat `plan-opencode.md` untuk rencana panjang:

- Integrasi QRIS production-ready (Midtrans/Xendit webhook)
- Offline sync (PowerSync)
- Print native ESC/POS (Capacitor/native bridge)
- Multi-toko, loyalty, promo, e-Faktur

## Dokumentasi Lengkap

- `POSkebaya-Vault/` — Obsidian knowledge vault (arsitektur, database, modul, backlog)
- `research/` — hasil riset teknis
- `QnA/` — catatan kebutuhan bisnis
