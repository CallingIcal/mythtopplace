import { call, pool, pct, tally, sql, log, ok, load, rssMB, alive } from './lib.mjs';
// P5: 1000 pembelian acak bersamaan, stok terbatas (20 per item) -> uji oversell
const MODE = process.argv[2] || 'limited';
const N = 1000, OFFSET = MODE === 'limited' ? 0 : 1000;
log(`== P5(${MODE}): ${N} pembelian acak bersamaan dari ${N} user berbeda ==`);
if (MODE === 'limited') sql('update TopupStock set stock=20, isActive=1, discountPercent=0');
else sql('update TopupStock set stock=1000000, isActive=1, discountPercent=0');
const users = load('users'), jars = load('jars');
const slugOf = { 1: 'ml', 2: 'ml', 3: 'pubg', 4: 'pubg', 5: 'coc', 6: 'coc', 7: 'roblox', 8: 'roblox' };
const pick = () => 1 + Math.floor(Math.random() * 8);
const jobs = Array.from({ length: N }, (_, i) => { const stockId = pick(); return { i: OFFSET + i, stockId, pay: 1 + Math.floor(Math.random() * 3) }; });
const before = rssMB(); const t0 = performance.now();
const rs = await Promise.all(jobs.map((j) => call('POST', '/transactions', { jar: jars[j.i], body: { topupStockId: j.stockId, paymentId: j.pay, gameUserId: slugOf[j.stockId] === 'roblox' ? `User ${j.i} (@user_${j.i})` : `${10000000 + j.i} (${1000 + (j.i % 9000)})` } })));
const secs = (performance.now() - t0) / 1000;
const t = tally(rs);
log('status:', JSON.stringify(t), `durasi ${secs.toFixed(1)}s`, `latensi p50=${pct(rs.map((r) => r.ms), .5)}ms p95=${pct(rs.map((r) => r.ms), .95)}ms max=${pct(rs.map((r) => r.ms), 1)}ms`, `| RSS ${before}MB -> ${rssMB()}MB`);
const fivexx = rs.filter((r) => r.status >= 500 || r.status === 0);
const sample = [...new Set(fivexx.map((r) => `${r.status} ${r.error || JSON.stringify(r.data).slice(0, 120)}`))].slice(0, 3);
ok('tidak ada error 5xx / koneksi putus', fivexx.length === 0, `${fivexx.length} error ${sample.join(' | ')}`);
ok('server tetap hidup setelah beban', await alive());
const neg = Number(sql('select count(*) from TopupStock where stock < 0'));
ok('stok tidak pernah negatif (tidak ada oversell)', neg === 0, `${neg} baris negatif`);
const created = Number(sql(`select count(*) from Transaction where userId in (select id from User where email like "%@loadtest.test") and status in ("PENDING","PROCESSING")`));
const succ = rs.filter((r) => r.status === 201).length;
if (MODE === 'limited') {
  ok('terjual persis sesuai stok (8 item x 20 = 160 maks)', succ <= 160 && Number(sql('select sum(stock) from TopupStock where id<=8')) === 160 - succ, `berhasil ${succ}, sisa stok ${sql('select sum(stock) from TopupStock where id<=8')}`);
  ok('sisa permintaan ditolak karena stok habis (400), bukan error', rs.filter((r) => r.status === 400).length === N - succ, `${rs.filter((r) => r.status === 400).length} x 400`);
} else {
  ok('semua pembelian berhasil saat stok cukup', succ === N, `berhasil ${succ}/${N}`);
  ok('stok berkurang tepat sebanyak pesanan', Number(sql('select 8*1000000 - sum(stock) from TopupStock where id<=8')) === succ);
}
const bad = Number(sql('select count(*) from Transaction where amount <> ROUND(amount - adminFee + adminFee, 2) or adminFee <> 1500'));
ok('semua pesanan membawa biaya admin 1500', bad === 0);
const perStock = sql('select topupStockId, count(*) from Transaction group by topupStockId order by topupStockId').replace(/\t/g, ':').replace(/\n/g, ' ');
log('INFO pesanan per nominal:', perStock);
