# MYTHTOPPLACE — Project Manual

## 1. Tujuan
MYTHTOPPLACE adalah aplikasi web top-up game mobile-first/PWA dengan frontend React + TypeScript + Vite, backend NestJS + TypeScript, Prisma ORM, dan MySQL. Paket ini menyatukan prototype, source code, deployment, dokumentasi, prompt pengembangan, serta prosedur pemeliharaan.

## 2. Struktur
- `frontend/` — UI React/Vite.
- `backend/` — API NestJS/Prisma.
- `docs/legacy-database.sql` — SQL lama (tidak dipakai; skema ada di `backend/prisma/schema.prisma`).
- `docker-compose.yml` — orkestrasi production sederhana.
- `.env.production.example` — template konfigurasi production.
- `docs/` — manual, runbook, SOP, flow, prototype spec, dan prompt pengembangan.

## 3. Stack
Frontend: React 18, TypeScript, Vite, CSS.
Backend: NestJS, TypeScript, Prisma.
Database: MySQL 8.x.
Reverse proxy: Nginx.
Deployment: Docker Compose.

## 4. Alur bisnis utama
1. Pengunjung membuka website.
2. User login/register.
3. User memilih game dan nominal.
4. User memasukkan ID game.
5. User memilih metode pembayaran.
6. Order dibuat sebagai `PENDING`; stok dipesan (dikurangi) secara atomik saat order dibuat.
7. Pembeli membayar sesuai panduan (QRIS, DANA, atau Mandiri), mengirim bukti (screenshot atau nomor pembayaran), lalu menekan "Saya sudah bayar" sehingga status menjadi `PROCESSING`. Total sudah termasuk biaya admin; pembayaran yang tidak sesuai nominal dapat didiskualifikasi admin. Pembayaran belum otomatis (belum ada payment gateway); admin memeriksanya manual.
8. Admin melihat order dan memeriksa pembayaran.
9. Jika valid, admin memverifikasi dan order menjadi `COMPLETED`.
10. Jika admin menolak, order menjadi `FAILED`. Jika pembeli membatalkan atau order `PENDING` melewati batas waktu, order menjadi `CANCELLED`. Pada kedua kasus stok dikembalikan.
11. User melihat status `Selesai`.
12. Semua tindakan penting admin dicatat dalam audit log.

## 5. Prinsip keamanan
- Rahasia hanya di `.env`, bukan source code.
- Password di-hash dengan bcrypt.
- JWT digunakan untuk autentikasi.
- Akses admin diverifikasi server-side.
- Jangan expose MySQL ke internet.
- Gunakan HTTPS.
- Validasi input di backend.
- Gunakan transaksi database untuk perubahan stok/order.
- Backup database secara rutin.
- Jangan menghapus audit log tanpa prosedur resmi.

## 6. Prinsip ringan
- API dipakai sebagai sumber data utama.
- Polling status dibatasi; gunakan WebSocket jika realtime penuh diaktifkan.
- Redis hanya ditambahkan jika benar-benar diperlukan.
- Image/static asset di-cache melalui Nginx/CDN.
- Query database memakai index dan pagination.

## 7. Larangan operasional
- Jangan commit `.env`.
- Jangan membagikan password admin.
- Jangan membuka port MySQL 3306 ke publik.
- Jangan memberikan role ADMIN melalui frontend.
- Jangan menurunkan validasi hanya agar fitur cepat selesai.
