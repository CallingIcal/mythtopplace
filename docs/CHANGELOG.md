# Changelog

## Initial consolidated package
- Frontend/backend source consolidated.
- Docker deployment files included.
- Nginx `/api` reverse proxy included.
- Health endpoint included.
- Manuals, prototype flow, operations SOP, and reusable prompts added.

## 0.2.0 - Perbaikan audit
- Perbaiki error 500 (BigInt) pada riwayat, buat order, dan daftar order admin.
- Verifikasi/tolak/batal atomik; stok dipesan saat order dibuat dan dikembalikan saat batal, ditolak, atau kedaluwarsa.
- Tambah batal oleh pembeli, tolak oleh admin, kedaluwarsa otomatis, konfirmasi pembayaran manual.
- Tambah pagination, filter status, kelola katalog, dan tampilan audit log di admin.
- Keamanan: rate limiting, helmet, CSP, JWT_SECRET wajib, validasi input, akun nonaktif langsung ditolak.
- Tambah Dockerfile backend, perbaikan docker-compose (MySQL 8.4), tipe frontend, viewport, dan PWA.

## 0.2.1
- Perbaiki header keamanan (CSP, X-Frame-Options, dll.) yang hilang pada halaman HTML karena aturan pewarisan add_header nginx.
- Throttle per pengunjung tetap benar saat HTTPS lewat Caddy (IP asli diteruskan).
- Login dengan sesi lama tidak lagi menampilkan "Sesi berakhir" saat password salah.
- Form katalog admin hanya dikosongkan jika penyimpanan berhasil; seed menolak email placeholder.

## 0.3.0 - Penguatan keamanan dan UI baru
- Sesi pindah dari localStorage ke cookie HttpOnly + SameSite=Strict + Secure; tambah anti-CSRF (header X-Requested-With), `GET /auth/me`, `POST /auth/logout`.
- Kunci akun 15 menit setelah 5 kali salah password; kebijakan password huruf + angka.
- Batas 5 pesanan belum dibayar per user (mencegah penimbunan stok); validasi karakter ID game.
- Container berjalan non-root, `no-new-privileges`, semua capability dibuang; nginx memakai image unprivileged (port internal 8080).
- Header HSTS lewat Caddy; cache singkat untuk daftar game dan metode bayar.
- Frontend: routing dengan URL (tombol Back berfungsi), halaman Admin dimuat terpisah, cache data sisi klien, skeleton loading, transisi halaman halus, dan tampilan baru yang lebih bersih (tema terang/gelap otomatis).

## 0.4.0 - Sesuai kebijakan keamanan
- Hashing password diganti ke Argon2id (salt acak per hash), menggantikan bcrypt.
- Aturan password user biasa: minimal 8 karakter dengan huruf kecil, huruf besar, dan angka; admin dikecualikan.
- Email wajib mengandung @ dan titik, dinormalkan ke huruf kecil, dan email duplikat ditolak.
- Rate limit global 60 per menit per IP; login dan register 5 per menit.
- Form daftar menampilkan checklist syarat password secara langsung.
- Tambah docs/SECURITY_PRINCIPLES.md dan file .env produksi yang sudah berisi akun admin.

## 0.4.1
- Tombol Tampilkan/Sembunyikan password di form masuk dan daftar, bisa dipakai berulang kali.
- Setelah login, aplikasi memastikan cookie sesi tersimpan dan memberi pesan jelas jika tidak (mis. COOKIE_SECURE di http).
- Seed membuka kunci akun admin setiap backend start; tambah perintah diagnosa `admin-check`.
- Mode demo menampilkan akun admin demo dengan tombol isi otomatis.

## 0.5.0 - Pembayaran lengkap, diskon, dan kelola katalog
- Panduan pembayaran: QRIS (gambar QRIS), Mandiri (rekening), DANA (nomor), dengan tombol salin dan peringatan diskualifikasi nominal tidak sesuai.
- Bukti pembayaran wajib (screenshot atau nomor pembayaran); admin dapat melihat screenshot.
- Biaya admin Rp1.500 per pembayaran; harga final dihitung di server.
- Robux meminta nama dan username Roblox.
- Perbaikan bug: tombol Tutup pilihan top up, tombol Kembali ke awal, logo mereset beranda.
- Admin: diskon per nominal dan massal per game, tambah game, ganti nama game dan nominal/gamepass, ubah harga dan stok.
- Pilihan nonaktif atau stok habis tampil "Sedang tidak tersedia" berwarna merah.
- Akun admin diganti dan tidak ditampilkan di halaman mana pun; `ADMIN_EXCLUSIVE` menurunkan admin lama.

## 0.6.0 - Hasil uji beban dan perbaikan
- Satu akun satu perangkat (user biasa); admin: login terbaru menang. Keluar otomatis setelah 40 menit AFK (server dan klien); polling tidak memperpanjang sesi, hanya aktivitas nyata (heartbeat).
- Maksimal 3 transaksi berjalan per user (PENDING + PROCESSING), atomik; batal otomatis 10 menit.
- Menu pembayaran menyatu: QRIS, rekening, atau nomor DANA, nominal yang harus dibayar, hitung mundur, peringatan cek data, dan kolom bukti dalam satu tempat.
- Admin: tombol Tolak memakai dialog di halaman (sebelumnya window.confirm yang diblokir), layar bukti screenshot diperbaiki (tidak terpotong), tulisan TIDAK TERDAPAT SS bila tidak ada screenshot.
- Perbaikan hasil uji beban: antrean pembuatan pesanan, pelindung beban (503 sopan), cache menu 3 sampai 5 detik dengan single-flight, cache sesi 5 detik, query riwayat tanpa transaksi, batas waktu server, backlog 4096, pool koneksi database 20, micro-cache nginx, batas koneksi nginx 16384.
- Verifikasi admin bersamaan kini idempoten. Log galat Prisma menampilkan kode (tanpa dikirim ke klien).
- Tambah folder loadtest/ dan docs/LOAD_TEST_REPORT.md.

## 0.7.0 - Profil, chat admin, dan detail transaksi
- Footer: tulisan diturunkan dan ada tombol Hubungi admin di bawahnya (chat dengan teks, foto opsional, dan rujukan pesanan; lencana pesan belum dibaca).
- Menu Profil: foto profil, nama (diganti seminggu sekali), telepon, Instagram, alamat. Riwayat pembelian dipindahkan ke dalam Profil dengan filter Berjalan, Selesai, Gagal/batal. Rute lama /riwayat tetap berfungsi dan membuka tab Riwayat.
- Detail transaksi lengkap untuk pembeli dan admin (linimasa, rincian harga, foto bukti, data pembeli untuk admin), tetap bisa dibuka setelah transaksi selesai.
- Admin: menu Pesan untuk membalas pembeli dengan lencana belum dibaca.
- Perbaikan hasil uji: deadlock saat banyak pesan pertama bersamaan (P2034) diatasi dengan urutan kunci yang benar dan percobaan ulang otomatis.
- Perbaikan hasil uji: endpoint baca terautentikasi dibebaskan dari batas per-IP agar pengguna yang berbagi IP (jaringan seluler) tidak saling memblokir; batas bisa diatur lewat .env.
- Tabel baru: UserAvatar, ChatThread, ChatMessage. Kolom baru: User (telepon, Instagram, alamat, waktu ganti nama), Transaction (paidAt, closedAt, listPrice, discountPercent).
