import { call, pct, tally, log, ok, load, rssMB, alive } from './lib.mjs';
const jars = load('jars'); const n = 10000; const before = rssMB(); const t0 = performance.now();
const rs = await Promise.all(Array.from({ length: n }, (_, i) => call('GET', '/transactions/mine', { jar: jars[i % 2000] })));
const secs = (performance.now() - t0) / 1000, t = tally(rs), lat = rs.map((r) => r.ms);
log(`10.000 klik Riwayat (login) bersamaan: status ${JSON.stringify(t)} | ${secs.toFixed(1)}s (${(n / secs).toFixed(0)} req/s) p50=${pct(lat, .5)}ms p95=${pct(lat, .95)}ms max=${pct(lat, 1)}ms | RSS ${before}->${rssMB()}MB`);
ok('Riwayat 10.000 klik: tidak ada error 500 / koneksi putus', !t[500] && !t[0], JSON.stringify(t));
log(`INFO dilayani sukses: ${((t[200] || 0) / n * 100).toFixed(0)}%, ditolak sopan 503: ${((t[503] || 0) / n * 100).toFixed(0)}%`);
ok('server hidup setelah beban', await alive());
process.exit(0);
