# Hosting Gratis untuk Presentasi

Repo GitHub **menyimpan kode**; web yang bisa dibuka dari browser perlu hosting terpisah. Untuk presentasi tersedia versi **demo**: seluruh tampilan dan aturan bisnis berjalan, tetapi "server"-nya disimulasikan di browser (data tersimpan di browser masing-masing). Demo memakai data contoh: rekening, nomor DANA, dan QRIS contoh, harga dikali 20, dan banner "MODE DEMO".

Backend asli (NestJS + MySQL) ada di folder `backend/` dan dijalankan dengan Docker (lihat `DEPLOYMENT_RUNBOOK.md`); itu butuh server dan tidak tersedia gratis tanpa batas di layanan di bawah.

## Opsi A (disarankan): Netlify, gratis, repo boleh private
1. Daftar di netlify.com dengan akun GitHub.
2. Add new site, Import an existing project, pilih GitHub, beri izin ke repo, pilih repo ini.
3. Pengaturan sudah dibaca otomatis dari `netlify.toml` (base `frontend`, perintah `npm ci && npm run build:demo`, folder `dist`). Tekan Deploy.
4. Setelah selesai, Netlify memberi alamat `https://nama-situs.netlify.app`. Nama bisa diganti di Site configuration, Change site name.
5. Setiap `git push` ke `main` otomatis memperbarui situs.

## Opsi B: GitHub Pages
1. Repo harus **public**, atau akun punya GitHub Pro (gratis lewat GitHub Student Developer Pack).
2. Settings, Pages, Source: **GitHub Actions**.
3. Push ke `main`; workflow `.github/workflows/pages.yml` membangun dan menerbitkan. Alamat: `https://USERNAME.github.io/NAMA-REPO/`.

## Opsi C: Cloudflare Pages atau Vercel (gratis, repo boleh private)
Root directory `frontend`, build command `npm ci && npm run build:demo`, output directory `dist`.

## Menjalankan versi demo di komputer sendiri
```bash
cd frontend
npm install
npm run build:demo     # hasil: frontend/dist/index.html (satu file, bisa dibuka langsung)
```

## Login admin di demo
Buka Masuk, isi email `admin@demo.test` dan sandi apa saja minimal 6 karakter. Sandi pertama yang diketik menjadi sandi admin demo **di browser itu saja**; masuk berikutnya harus memakai sandi yang sama. Untuk mengulang dari awal, hapus data situs di browser.

## Menjalankan sistem penuh (backend asli) di laptop
Dengan Docker Desktop terpasang: salin `.env.production.example` menjadi `.env`, isi nilainya (set `COOKIE_SECURE=false` untuk http lokal), lalu `docker compose up -d --build` dan buka `http://localhost`. Cocok untuk demo langsung ke dosen tanpa internet.
