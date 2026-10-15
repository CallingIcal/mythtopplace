# User Manual

## Pembeli
1. Buka website.
2. Pilih game.
3. Pilih nominal top-up.
4. Masukkan ID game yang benar.
5. Pilih metode pembayaran.
6. Buat order.
7. Selesaikan pembayaran sesuai instruksi yang tampil, lalu buka Riwayat dan tekan "Saya sudah bayar" (isi nomor referensi bila ada). Pesanan yang belum dibayar bisa dibatalkan, dan otomatis batal jika melewati batas waktu.
8. Pantau status di riwayat transaksi.
9. Status `Dalam Proses` berarti order masih diverifikasi/diproses.
10. Status `Selesai` berarti admin telah memverifikasi penyelesaian.

## Admin
1. Login menggunakan akun admin yang dibuat melalui seed/env.
2. Buka panel admin.
3. Periksa detail order dan status pembayaran.
4. Setelah pesanan benar-benar selesai, gunakan aksi verifikasi.
5. Jangan menekan selesai jika order belum benar-benar diproses. Gunakan Tolak jika pembayaran tidak valid.
6. Tab Katalog dipakai untuk menambah game, menambah nominal, mengubah stok dan harga, serta menonaktifkan produk.
7. Perubahan stok dan audit log dilakukan oleh backend.

## Praktik aman
- Jangan berikan password kepada orang lain.
- Pastikan ID game benar sebelum pembayaran.
- Jangan membagikan token/session dari browser.
- Laporkan order bermasalah kepada admin.
