# Operations SOP

## Incident: API down
1. `docker compose ps`
2. `docker compose logs --tail=200 backend`
3. `curl http://127.0.0.1/api/health`
4. Periksa disk/RAM.
5. Restart service hanya setelah membaca log.

## Incident: database issue
1. Stop perubahan transaksi jika diperlukan.
2. Cek MySQL container/log.
3. Jangan menghapus volume.
4. Ambil backup/snapshot sebelum tindakan destruktif.
5. Restore hanya berdasarkan prosedur teruji.

## Incident: suspicious admin activity
1. Preserve audit logs.
2. Rotate credentials/secrets jika ada indikasi kompromi.
3. Nonaktifkan akses yang dicurigai.
4. Review transaction history.
5. Dokumentasikan timeline.

## Release
- Backup.
- Deploy image/code.
- Run migration.
- Health check.
- Smoke test user/admin.
- Monitor.
- Rollback bila release menyebabkan failure.
