# MYTHTOPPLACE

Aplikasi web top-up game: React + Vite (frontend), NestJS + Prisma (backend), MySQL, Nginx, Docker Compose.

## Untuk penilai
- **Demo online:** `ISI_LINK_DEMO_DI_SINI` (versi demo memakai server tiruan di browser, data contoh, harga dikali 20). Login admin demo: lihat `docs/HOSTING_GRATIS.md`.
- **Sistem penuh:** backend asli ada di `backend/`; jalankan dengan `docker compose up -d --build` (lihat `docs/DEPLOYMENT_RUNBOOK.md`).
- **Pengujian:** skrip uji beban dan fungsi di `loadtest/`, hasilnya di `docs/LOAD_TEST_REPORT.md` (pendaftaran 10.000 akun, 1.000 pembelian bersamaan, 10.000 klik bersamaan, dan sistem admin).

## Fitur
Katalog game dan top-up dengan diskon, checkout dengan biaya admin, pembayaran QRIS/rekening/DANA dengan bukti pembayaran, verifikasi admin, riwayat dan detail transaksi, profil pengguna, chat dengan admin, kelola katalog, audit log, satu akun satu perangkat, keluar otomatis saat tidak aktif, dan pembatalan otomatis pesanan yang tidak dibayar.

## Dokumentasi
`docs/DEVELOPER_MANUAL.md` (API dan aturan), `docs/SECURITY_PRINCIPLES.md`, `docs/PROJECT_MANUAL.md`, `docs/FLOW.md`, `docs/CHANGELOG.md`, `docs/HOSTING_GRATIS.md`.

Jangan menyimpan kredensial nyata di repository; isi `.env` hanya di server.
