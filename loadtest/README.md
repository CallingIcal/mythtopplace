# Skrip uji beban dan fungsi

Skrip ini dipakai untuk menguji backend sampai ribuan pengguna. **Jangan jalankan terhadap server produksi**: skrip membuat puluhan ribu akun palsu dan pesanan.

## Syarat
- Node 20+, klien `mariadb` atau `mysql` di PATH (beberapa tahap mengubah waktu sesi lewat SQL), dan backend uji berjalan di `http://127.0.0.1:3000` dengan database kosong yang sudah di-seed.
- Jalankan langsung ke port backend (bukan lewat nginx): skrip memakai header `X-Forwarded-For` unik agar rate limit per IP tidak menghalangi uji beban. Lewat nginx, IP dipaksa menjadi IP klien sehingga rate limit berlaku.
- Isi akun admin uji: `LT_ADMIN_EMAIL` dan `LT_ADMIN_PASSWORD` (sama dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di `.env` server uji).
- Atur alamat dengan `LT_BASE=http://host:3000/api`. Nama database di fungsi `sql()` (`lib.mjs`) disesuaikan dengan lingkunganmu.

## Urutan
`p1` daftar 10.000 akun, `p2` akun duplikat dan input berbahaya, `p3` login 2.000 user, `p4` satu perangkat dan AFK, `p5 limited` / `p5 high` pembelian 1.000 bersamaan, `p6` batas 3 transaksi, `p7` ledakan 10.000 klik dan rate limit, `p8` sistem admin dan harga, `p9` pembatalan otomatis.
Hasil tercatat di `/tmp/lt/results.log`.
