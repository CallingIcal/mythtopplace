# Security & Ecosystem Maintenance

## Baseline
- Ubuntu LTS di VPS.
- Docker dan image resmi/terpercaya.
- Nginx sebagai reverse proxy.
- HTTPS wajib.
- MySQL hanya di network internal Docker.
- SSH key lebih disarankan daripada password.
- Firewall hanya membuka 22, 80, 443 sesuai kebutuhan.

## Harian
- Cek status container.
- Cek error log singkat.
- Cek `/api/health`.
- Cek transaksi yang tertahan.

## Mingguan
- Review audit log.
- Review disk/RAM/CPU.
- Cek backup database.
- Update dependency yang penting setelah pengujian.

## Bulanan
- Patch OS.
- Update Docker images.
- Review user/admin accounts.
- Test restore backup.
- Audit endpoint publik.

## Backup
Backup minimal database secara berkala dan simpan salinan di lokasi berbeda dari VPS. Uji restore; backup yang tidak pernah diuji bukan jaminan pemulihan.

## Scaling bertahap
1. Optimalkan query/index terlebih dahulu.
2. Tambahkan cache untuk data yang stabil.
3. Tambahkan Redis untuk rate limit/pubsub jika trafik meningkat.
4. Tambahkan WebSocket untuk realtime.
5. Pisahkan worker/payment processor bila volume transaksi meningkat.
6. Tambahkan monitoring dan centralized logs.

## Secrets
Gunakan secret manager atau environment secret pada platform deployment. Jangan memasukkan credential nyata ke repository, prompt, screenshot, atau dokumentasi publik.
