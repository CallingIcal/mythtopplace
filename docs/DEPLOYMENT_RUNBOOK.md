# Deployment Runbook — mythtopplace.com

## Persiapan
- VPS Ubuntu LTS dengan Docker Engine + Docker Compose plugin.
- DNS: A record `@` (dan `www`) ke IP VPS.
- Firewall: buka 22, 80, 443 saja. Jangan buka 3000 atau 3306.

## Deploy
```bash
mkdir -p /opt/mythtopplace && cd /opt/mythtopplace
# upload/extract proyek di sini
cp .env.production.example .env
nano .env        # isi semua nilai CHANGE_ME, ADMIN_EMAIL, ADMIN_PASSWORD (pakai tanda kutip jika ada #)
docker compose up -d --build
docker compose ps
```
Backend akan gagal start dengan pesan jelas bila `JWT_SECRET`, `ADMIN_EMAIL`, atau `ADMIN_PASSWORD` masih placeholder. Lihat `docker compose logs backend`.

Uji pertama lewat `http://IP-VPS` (tanpa HTTPS): set `COOKIE_SECURE=false` di `.env`, login tidak akan berjalan jika cookie `Secure` dikirim lewat HTTP. Kembalikan ke `true` begitu HTTPS aktif.

## Health check
```bash
curl http://127.0.0.1/api/health
# {"ok":true,"service":"topup-api"}
```

## HTTPS (Caddy di host)
1. Di `.env` set `FRONTEND_BIND=127.0.0.1:8080` lalu `docker compose up -d`.
2. Pasang Caddy, isi `/etc/caddy/Caddyfile`:
```
mythtopplace.com, www.mythtopplace.com {
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
    reverse_proxy 127.0.0.1:8080
}
```
3. `sudo systemctl reload caddy`. Sertifikat Let's Encrypt diurus otomatis.
4. Pastikan `CORS_ORIGINS=https://mythtopplace.com`.

## Admin tidak bisa masuk
1. Cek akun: `docker compose exec backend node dist/admin-check.js`. Hasilnya menunjukkan apakah email admin ada, role-nya, aktif atau tidak, terkunci atau tidak, dan apakah sandi di `.env` cocok.
2. Jika "TIDAK ADA" atau sandi tidak cocok: pastikan `ADMIN_EMAIL`, `ADMIN_PASSWORD`, dan `ADMIN_PASSWORD_SYNC=true` ada di `.env`, lalu `docker compose up -d --force-recreate backend`. Seed berjalan setiap start, membuat atau memperbarui admin, dan membuka kunci akun.
3. Jika login terlihat berhasil tetapi langsung keluar: situs dibuka lewat `http://`. Set `COOKIE_SECURE=false` untuk uji tanpa HTTPS, atau aktifkan HTTPS.
4. Lihat log seed: `docker compose logs backend | grep "Admin siap"`.

## Update
Perubahan skema selalu bersifat menambah (kolom dan tabel baru); `prisma db push` saat backend start menerapkannya tanpa menghapus data lama. Backup dulu sebelum update (lihat bagian Backup).
```bash
git pull && docker compose up -d --build
```

## Backup MySQL
```bash
docker compose exec mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
```
Simpan di luar VPS dan uji restore secara berkala.

## Post-deploy
Buka homepage, register user uji, buat order, tekan "Saya sudah bayar", login admin, verifikasi, cek status `Selesai`, cek tab Audit log. Hapus akun/data uji sesuai SOP.
