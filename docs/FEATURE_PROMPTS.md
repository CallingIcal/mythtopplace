# Reusable Feature Prompts

## Payment Gateway
Integrasikan payment gateway nyata ke MYTHTOPPLACE. Pisahkan adapter payment provider dari domain transaction. Verifikasi webhook dengan signature resmi provider, cegah replay/duplicate event, simpan raw event yang aman, gunakan idempotency key, dan update transaction dalam database transaction. Jangan menandai pembayaran sukses hanya berdasarkan callback dari browser.

## WebSocket
Tambahkan Socket.IO untuk status transaksi realtime. User hanya boleh subscribe ke transaksi miliknya. Admin channel harus memiliki server-side role guard. Fallback polling tetap tersedia jika socket terputus. Batasi event agar tidak membebani server.

## PWA
Tambahkan manifest, service worker, installability, cache static assets, dan offline fallback. Jangan cache response sensitif seperti token, transaksi pribadi, atau endpoint admin secara sembarangan.

## Rate Limiting
Tambahkan rate limit per IP/user pada login, register, order creation, dan admin actions. Gunakan Redis hanya bila deployment multi-instance membutuhkan shared limiter.

## Observability
Tambahkan structured logs, request ID, health/readiness checks, error monitoring, dan metrics ringan. Jangan mencatat password, JWT, payment secrets, atau data sensitif.
