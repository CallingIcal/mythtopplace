# Master Prompt — MYTHTOPPLACE

Bangun dan kembangkan aplikasi web top-up game bernama MYTHTOPPLACE. Gunakan React 18 + TypeScript + Vite untuk frontend, NestJS + TypeScript untuk backend, Prisma ORM, dan MySQL. Gunakan Nginx sebagai reverse proxy pada production. Frontend production memanggil API melalui relative path `/api`.

Fitur inti: register/login, JWT, role USER/ADMIN, katalog game Mobile Legends/PUBG/Clash of Clans/Roblox, pilihan nominal, input Game ID, payment methods QRIS/DANA/MANDIRI, order lifecycle PENDING → PROCESSING → COMPLETED/CANCELLED, riwayat transaksi, admin verification, stock deduction atomik, audit log, health endpoint.

Prinsip: mobile-first, premium sederhana, ringan, aman, server-side authorization, validation, bcrypt, rate limiting, HTTPS, MySQL internal-only, pagination, indexes, atomic transactions, dan secret melalui environment variables.

Jangan pernah menulis password nyata, token, private key, atau credential ke source code. Jangan membuat klaim bahwa payment gateway nyata sudah aktif bila belum ada integration/webhook yang benar-benar teruji.

Setiap perubahan harus menjaga kompatibilitas dengan struktur proyek yang ada, menjelaskan file yang berubah, dan memberi langkah migration/deployment jika schema atau environment berubah.
