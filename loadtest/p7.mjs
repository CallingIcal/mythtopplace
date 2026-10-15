import { call, pool, pct, tally, log, ok, load, rssMB, alive, nextIp } from './lib.mjs';
log('== P7: ledakan 10.000 klik bersamaan + rate limit ==');
const jars = load('jars');
async function burst(name, n, make) {
  const before = rssMB(); const t0 = performance.now();
  const rs = await Promise.all(Array.from({ length: n }, (_, i) => make(i)));
  const secs = (performance.now() - t0) / 1000;
  const t = tally(rs); const lat = rs.map((r) => r.ms);
  const errs = [...new Set(rs.filter((r) => r.status === 0).map((r) => r.error))].slice(0, 3).join(',');
  log(`${name}: status ${JSON.stringify(t)} | selesai ${secs.toFixed(1)}s (${(n / secs).toFixed(0)} req/s) | p50=${pct(lat, .5)}ms p95=${pct(lat, .95)}ms p99=${pct(lat, .99)}ms max=${pct(lat, 1)}ms | RSS ${before}->${rssMB()}MB ${errs ? '| error: ' + errs : ''}`);
  return { rs, t };
}
const a = await burst('10.000 klik bersamaan: menu daftar nominal (publik)', 10000, () => call('GET', '/games/1/stocks'));
ok('10.000 klik: semua dilayani 200, tanpa crash/timeout', a.t[200] === 10000, JSON.stringify(a.t));
ok('server hidup setelah 10.000 klik', await alive());
const b = await burst('10.000 klik bersamaan: halaman Riwayat (butuh login, 2000 user x5)', 10000, (i) => call('GET', '/transactions/mine', { jar: jars[i % 2000] }));
ok('10.000 klik Riwayat: tanpa error 5xx', Object.keys(b.t).every((k) => Number(k) < 500 && Number(k) !== 0), JSON.stringify(b.t));
ok('server hidup setelah beban terautentikasi', await alive());
const c = await burst('10.000 klik bersamaan: daftar game', 10000, () => call('GET', '/games'));
ok('daftar game 10.000 klik: semua 200', c.t[200] === 10000, JSON.stringify(c.t));
// rate limit dari satu IP (tanpa spoof): global 60/menit, login 5/menit
const ip = '10.77.77.77';
const gets = []; for (let i = 0; i < 70; i++) gets.push((await call('GET', '/games', { ip })).status);
ok('rate limit global 60/menit per IP: permintaan ke-61 dst. 429', gets.slice(0, 60).every((s) => s === 200) && gets.slice(60).every((s) => s === 429), `200:${gets.filter((s) => s === 200).length} 429:${gets.filter((s) => s === 429).length}`);
const ip2 = '10.88.88.88'; const logins = [];
for (let i = 0; i < 8; i++) logins.push((await call('POST', '/auth/login', { ip: ip2, body: { email: 'x@y.zz', password: 'Salah1234' } })).status);
ok('rate limit login 5/menit per IP: percobaan ke-6 dst. 429', logins.slice(0, 5).every((s) => s === 401) && logins.slice(5).every((s) => s === 429), logins.join(','));
ok('server hidup setelah rate limit', await alive());
