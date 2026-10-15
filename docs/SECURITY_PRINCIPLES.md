# Prinsip Keamanan dan Penerapannya

| Prinsip | Penerapan di kode |
|---|---|
| Password tidak disimpan langsung | Hanya hash yang disimpan di kolom `User.password`. |
| Hash lambat + salt | Argon2id (`backend/src/common/password.ts`). Salt acak dibuat otomatis per hash, jadi dua user dengan password sama tetap tersimpan berbeda. |
| Rate limiting | `@nestjs/throttler`: 60 request per menit per IP untuk semua endpoint, 5 per menit untuk login dan register, 30 per menit untuk pesanan. Akun juga dikunci 15 menit setelah 5 kali salah password. |
| Parameterized query | Semua akses database lewat Prisma (parameterized). Satu-satunya query mentah adalah `SELECT 1` konstan di health check. Dilarang memakai `$queryRawUnsafe` atau `$executeRawUnsafe`. |
| Never trust user input | `ValidationPipe` dengan `whitelist` dan `forbidNonWhitelisted`, DTO dengan batas panjang dan format, `ParseBigIntPipe` untuk ID, filter status dibatasi enum, ID game dibatasi karakter. |
| Sesi aman | Cookie HttpOnly + SameSite=Strict + Secure, header anti-CSRF, token tidak ada di JavaScript. |

## Aturan akun
- **User biasa:** password minimal 8 karakter, wajib ada huruf kecil, huruf besar, dan angka (`backend/src/auth/password-policy.ts`).
- **Admin:** dibuat dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di `.env` saat backend start, tidak melewati aturan di atas sehingga boleh memakai sandi huruf kecil semua. Pendaftaran publik selalu menghasilkan role USER.
- **Email:** wajib mengandung `@` dan titik; huruf besar/kecil dianggap sama; email yang sudah terdaftar ditolak dengan pesan untuk memakai alamat lain.

## Tambahan
- **Admin tunggal:** dengan `ADMIN_EXCLUSIVE=true` (default), seed menurunkan admin lain menjadi user sehingga hanya `ADMIN_EMAIL` yang menjadi admin.
- **Bukti bayar:** hanya JPEG asli yang diterima (header file diperiksa), maksimal 400.000 karakter, ditampilkan sebagai gambar (bukan HTML), dan tidak ikut daftar pesanan.
- **Harga dihitung di server:** klien tidak bisa mengirim harga, diskon, atau biaya admin sendiri.

## Catatan operasional
- `.env` berisi rahasia asli. Jangan di-commit atau dikirim lewat chat. Setelah admin berhasil login pertama kali, sebaiknya ganti `ADMIN_PASSWORD` dengan sandi yang lebih kuat lalu jalankan ulang backend (`ADMIN_PASSWORD_SYNC=true` memperbarui hash admin).
- Penguncian akun berlaku juga untuk admin: orang lain bisa mengunci akun admin selama 15 menit dengan menebak sandinya berulang. Rate limit 5 per menit per IP membatasi seberapa cepat hal itu terjadi.
