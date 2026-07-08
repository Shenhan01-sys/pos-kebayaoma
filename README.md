# Kebaya Oma POS

POS (Point of Sale) tablet untuk toko fashion / kebaya di Indonesia.
Dibangun dengan **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Zustand**.

## Fitur (Frontend, dummy data)
- Kasir POS: katalog, keranjang, varian (ukuran/warna), checkout QRIS/Tunai/Transfer, diskon, Pajak (VAT 12%), struk + print.
- Manajemen Produk CRUD + editor varian, Kategori.
- Inventori & Stok: restock, penyesuaian, riwayat pergerakan.
- Pelanggan & Staff (role + PIN).
- Transaksi, Shift, Laporan (export CSV).
- Label QR per produk -> profil publik; Verifikasi pembayaran via QR di struk.
- Data persist di localStorage (belum terhubung backend).

## Deploy (Vercel)
Repo ini siap di-import ke Vercel sebagai project Next.js (framework otomatis terdeteksi).
Build command: `next build`, output: `.next` (Vercel-managed).

```bash
npm install
npm run build
npm run start   # atau npm run dev
```

## Roadmap (lih. plan-opencode.md)
Integrasi Supabase (DB/Auth/Realtime), payment gateway QRIS (Xendit/Midtrans),
offline sync (PowerSync), print native ESC/POS, scan kamera.
