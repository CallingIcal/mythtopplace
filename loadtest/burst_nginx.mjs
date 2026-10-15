import { call, pct, tally, log, ok, rssMB, alive } from './lib.mjs';
const n = 10000; const t0 = performance.now();
const rs = await Promise.all(Array.from({ length: n }, () => call('GET', '/games/1/stocks')));
const secs = (performance.now() - t0) / 1000, t = tally(rs), lat = rs.map((r) => r.ms);
log(`10.000 klik bersamaan LEWAT NGINX (menu nominal): status ${JSON.stringify(t)} | ${secs.toFixed(1)}s (${(n / secs).toFixed(0)} req/s) p50=${pct(lat, .5)}ms p95=${pct(lat, .95)}ms max=${pct(lat, 1)}ms | RSS backend ${rssMB()}MB`);
ok('10.000 klik via nginx: semua 200', t[200] === n, JSON.stringify(t));
process.exit(0);
