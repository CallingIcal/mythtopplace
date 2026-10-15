# Laporan Uji Beban dan Fungsi

Lingkungan: backend asli (NestJS + Prisma) dengan MariaDB 10.11, satu server 1 CPU dan 4 GB RAM. Server, database, dan pembuat beban berbagi satu CPU, jadi angka di bawah konservatif. Prisma di sandbox memakai adapter MariaDB (tanpa engine Rust); kode aplikasi yang diuji sama. Nginx diuji dengan paket nginx biasa. Pada server produksi dengan banyak core, hasilnya lebih baik.

| Uji | Sebelum perbaikan | Sesudah perbaikan |
|---|---|---|
| Daftar 10.000 akun (sandi berbeda) | 10.000 berhasil, 29 akun/detik (Argon2 memakai CPU) | sama, hash semua berbeda dan berformat Argon2id |
| 1.000 pembelian acak bersamaan, stok 20 per item | 85 berhasil, **915 error 500** (antrean koneksi database habis) | 160 berhasil (persis sesuai stok), 840 ditolak "stok habis", **0 error**, tanpa oversell |
| 1.000 pembelian bersamaan, stok besar | tidak diuji | 1.000 dari 1.000 berhasil (15 detik di 1 CPU) |
| 10.000 klik bersamaan, menu nominal | 6.864 berhasil, 2.595 koneksi timeout, 541 error 500, memori 345 ke 712 MB | **10.000 berhasil**, memori 339 ke 386 MB; lewat nginx juga 10.000 berhasil |
| 10.000 klik bersamaan, halaman Riwayat (login) | sebagian permintaan menggantung lebih dari 5 menit | 68% terlayani, 32% ditolak sopan (503 + Retry-After), 0 error 500, server tetap hidup |
| 20 verifikasi admin bersamaan | hasil benar, tetapi yang kalah mendapat error 400 | semua 200 (idempoten), audit log tepat 1 |

Hasil fungsi yang lolos: duplikat email (termasuk balapan 20 pendaftaran), satu akun satu perangkat (balapan 10 login), AFK 40 menit, heartbeat, batas 3 transaksi (atomik di bawah balapan), batal otomatis 10 menit, seluruh sistem admin, keselarasan harga admin dan user, rate limit 60 per menit dan login 5 per menit, anti SQL injection dan CSRF.

## Batas yang perlu dipahami
- 10.000 pengguna yang menekan halaman yang butuh login pada detik yang sama melampaui kapasitas 1 CPU (sekitar 170 sampai 460 permintaan per detik). Sistem tidak crash dan menolak sebagian dengan sopan. Untuk beban seperti itu, tambah core CPU dan jalankan beberapa replika backend.
- Pendaftaran dan login memakai Argon2id yang sengaja berat (sekitar 30 per detik per core). Banjir login ditahan dengan antrean 400 dan jawaban 503.
- Cache menu publik berlaku 3 sampai 5 detik, jadi perubahan stok atau harga oleh user lain bisa terlambat beberapa detik di tampilan (perubahan admin langsung membersihkan cache backend; cache nginx hingga 3 detik).

## Uji fitur 0.7.0 (profil, chat, detail transaksi)
169 pemeriksaan terhadap backend asli lolos (78 fitur baru, 16 akun duplikat, 15 sesi, 8 batas transaksi, 41 admin, 7 pembatalan otomatis, 4 batas laju) ditambah 36 pemeriksaan tampilan.

Temuan dan perbaikan dari uji ini:
| Temuan | Perbaikan |
|---|---|
| 8 pesan pertama yang bersamaan pada percakapan baru: 6 error 500 (deadlock database P2034) | percakapan dibuat lebih dulu di luar transaksi, baris percakapan dikunci sebelum pesan disisipkan, percobaan ulang otomatis; hasil ulang: semua 201 dan penghitung belum-dibaca akurat |
| Polling chat dan riwayat menambah permintaan per IP sehingga pengguna yang berbagi IP bisa saling kena batas 60/menit | endpoint baca terautentikasi dikecualikan dari batas per-IP; batas lain tetap; uji: 150 polling dari satu IP semuanya 200 |
| Uji 1.000 pembelian bersamaan dan 10.000 klik menu diulang pada versi final | 160 berhasil dan 840 ditolak stok habis tanpa error; 10.000 klik semuanya 200 |
