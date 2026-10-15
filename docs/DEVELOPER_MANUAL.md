# Developer Manual

## Struktur
`backend/` (NestJS + Prisma), `frontend/` (React + Vite), `docker-compose.yml`, `docs/`.

## Pengembangan lokal
Siapkan MySQL 8 lokal, lalu:

```bash
cd backend
npm install
cp .env.example .env        # isi DATABASE_URL, JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma generate
npx prisma db push
npm run seed:dev
npm run start:dev           # http://localhost:3000/api
```

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, /api diteruskan ke localhost:3000
```

## Autentikasi
Sesi memakai cookie `mtp_session` (HttpOnly, SameSite=Strict, Secure). Token tidak pernah disimpan di JavaScript. Semua permintaan POST/PATCH wajib membawa header `X-Requested-With: mtp` (anti-CSRF); frontend menambahkannya otomatis. Endpoint: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Akun dikunci 15 menit setelah 5 kali salah password.

## Password dan akun
Password di-hash dengan Argon2id. Aturan user biasa dan admin ada di `docs/SECURITY_PRINCIPLES.md`.

## Pembayaran, biaya, dan diskon
- Total = harga setelah diskon + biaya admin (`ADMIN_FEE`, default 1500). Dihitung di server dan disimpan di pesanan (`amount`, `adminFee`).
- Tujuan bayar ditampilkan dari `.env`: `PAY_MANDIRI_NAME/NUMBER`, `PAY_DANA_NAME/NUMBER`. Gambar QRIS ada di `frontend/src/assets/qris.jpeg` (ganti file lalu build ulang).
- Pembeli wajib mengirim bukti saat menekan "Saya sudah bayar": screenshot (JPEG, dikompres di browser, diperiksa header file di server) atau nomor pembayaran. Bukti disimpan di tabel `TransactionProof`, diambil admin lewat `GET /admin/transactions/:id/proof`.
- Diskon per nominal (`discountPercent`, 0 sampai 90) atau massal per game: `PATCH /admin/games/:id/discount`.
- Game/nominal nonaktif atau stok 0 tetap tampil ke pembeli sebagai "Sedang tidak tersedia" (merah) dan tidak bisa dipesan.
- Game dengan slug `roblox` meminta nama dan username, disimpan sebagai `Nama (@username)`.
- Admin: ubah nama game, deskripsi, nama nominal/gamepass, harga, stok, diskon, tambah game dan nominal (tab Katalog).

## Profil, chat, dan detail transaksi
- **Profil** (`GET/PATCH /profile`, `PUT/DELETE/GET /profile/avatar`): nama, telepon (format Indonesia), Instagram, alamat, foto JPEG. Nama hanya dapat diganti seminggu sekali (dicek atomik di server). Foto disimpan di tabel terpisah `UserAvatar` dan disajikan sebagai gambar, bukan di JSON.
- **Chat dengan admin** (`GET/POST /chat`, `GET /chat/summary`, `POST /chat/read`, `GET /chat/messages/:id/image`; admin: `GET /admin/chat/threads`, `GET /admin/chat/summary`, `GET/POST /admin/chat/:userId`, `POST /admin/chat/:userId/read`): satu percakapan per user, teks maksimal 1000 karakter, foto JPEG opsional, rujukan ke pesanan milik sendiri. Pesan baru diambil lewat polling `?after=` (GET tidak memperpanjang sesi). Kirim pesan dibatasi 10 per menit per IP.
- **Detail transaksi** (`GET /transactions/:id`, `GET /transactions/:id/proof`, admin `GET /admin/transactions/:id`): linimasa (dibuat, dibayar, diverifikasi, dibatalkan/ditolak), harga normal, diskon, biaya admin, total, foto bukti, dan untuk admin data pembeli. Tersedia selama transaksi ada, termasuk setelah selesai. Harga normal dan diskon disimpan saat order dibuat sehingga detail tidak berubah ketika katalog diubah.
- **Riwayat**: `GET /transactions/mine?filter=active|done|closed`.
- Endpoint baca (GET) yang butuh login tidak terkena batas per-IP (polling aman untuk pengguna yang berbagi IP); endpoint publik, login/daftar, dan kirim pesan tetap dibatasi. Batas diatur dengan `RATE_LIMIT_PER_MIN` dan `AUTH_RATE_LIMIT_PER_MIN`.

## Skema
Sumber tunggal: `backend/prisma/schema.prisma`. Setelah mengubahnya jalankan `npx prisma db push` (dev) dan uji endpoint terkait. Container backend menjalankan `prisma db push` lalu seed setiap start.

## Seed
Membuat role, akun admin dari `ADMIN_EMAIL`/`ADMIN_PASSWORD`, metode pembayaran, dan data contoh hanya jika belum ada game. Password admin yang sudah ada tidak diubah kecuali `ADMIN_PASSWORD_SYNC=true`.

## API (prefix `/api`)
Publik: `GET /health`, `GET /games`, `GET /games/payments`, `GET /games/:id/stocks`, `POST /auth/register`, `POST /auth/login`.
Pembeli (JWT): `POST /transactions`, `GET /transactions/mine?page=`, `POST /transactions/:id/confirm-payment`, `POST /transactions/:id/cancel`.
Admin (JWT + ADMIN): `GET /admin/transactions?status=&page=`, `PATCH /admin/transactions/:id/verify`, `PATCH /admin/transactions/:id/reject`, `GET /admin/catalog`, `POST /admin/games`, `PATCH /admin/games/:id`, `POST /admin/stocks`, `PATCH /admin/stocks/:id`, `GET /admin/audit-logs`.

## Checklist uji
- Register/login valid dan tidak valid; email duplikat memberi 409.
- User tidak bisa mengakses `/admin/*`; user hanya melihat order miliknya.
- Buat order mengurangi stok; batal, tolak, dan kedaluwarsa mengembalikannya.
- Dua verifikasi bersamaan tidak mengurangi stok dua kali (stok tidak berubah saat verifikasi).
- Stok tidak bisa negatif; order saat stok 0 ditolak.
- Token kedaluwarsa mengembalikan user ke halaman masuk.
- `/api/health` sehat setelah deployment.

## Batasan yang diketahui
Pembayaran belum otomatis. Tambahkan payment gateway sesuai `FEATURE_PROMPTS.md` sebelum transaksi komersial skala besar.
