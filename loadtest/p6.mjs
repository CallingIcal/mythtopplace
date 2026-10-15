import { call, sql, log, ok, load, ADMIN } from './lib.mjs';
// P6: batas 3 transaksi berjalan per user (termasuk balapan)
log('== P6: batas 3 transaksi berjalan per user ==');
sql('update TopupStock set stock=1000000, isActive=1');
const users = load('users');
const mk = async (i) => { const jar = {}; sql(`update User set sessionId=NULL,lastSeenAt=NULL where email='${users[i].email}'`); const r = await call('POST', '/auth/login', { body: { email: users[i].email, password: users[i].password }, jar }); if (r.status !== 200) throw new Error('login gagal ' + r.status); return jar; };
const order = (jar, n = 1) => call('POST', '/transactions', { jar, body: { topupStockId: 1, paymentId: 1, gameUserId: `1234567${n} (1234)` } });
const j1 = await mk(4000);
const seq = []; for (let i = 0; i < 4; i++) seq.push((await order(j1, i)).status);
ok('3 pesanan pertama berhasil, ke-4 ditolak 429', seq.join(',') === '201,201,201,429', seq.join(','));
const mine = await call('GET', '/transactions/mine', { jar: j1 });
const first = mine.data.items[0];
const canc = await call('POST', `/transactions/${first.id}/cancel`, { jar: j1 });
ok('batalkan 1 pesanan', canc.status === 200);
ok('setelah ada slot kosong, pesanan baru diterima', (await order(j1, 9)).status === 201);
// balapan: 10 permintaan bersamaan satu user
const j2 = await mk(4001);
const race = await Promise.all(Array.from({ length: 10 }, (_, n) => order(j2, n)));
const wins = race.filter((r) => r.status === 201).length;
ok('10 pesanan bersamaan dari 1 user: tepat 3 berhasil (batas atomik)', wins === 3 && race.every((r) => [201, 429].includes(r.status)), `berhasil ${wins}, ditolak ${race.filter((r) => r.status === 429).length}, lain ${race.filter((r) => ![201, 429].includes(r.status)).length}`);
const active = Number(sql(`select count(*) from Transaction where userId=(select id from User where email='${users[4001].email}') and status in ('PENDING','PROCESSING')`));
ok('DB: transaksi berjalan user itu = 3', active === 3, `${active}`);
// PROCESSING juga dihitung berjalan; setelah admin ACC baru bisa lagi
const j3 = await mk(4002);
const ids = []; for (let i = 0; i < 3; i++) { const r = await order(j3, i); ids.push(r.data.id); }
for (const id of ids) await call('POST', `/transactions/${id}/confirm-payment`, { jar: j3, body: { paymentRef: 'REF-' + id } });
ok('3 transaksi PROCESSING masih menghitung (pesanan ke-4 ditolak)', (await order(j3, 5)).status === 429);
const adm = {}; await call('POST', '/auth/login', { body: { email: ADMIN.email, password: ADMIN.password }, jar: adm });
const ver = await call('PATCH', `/admin/transactions/${ids[0]}/verify`, { jar: adm });
ok('admin ACC 1 transaksi', ver.status === 200 && ver.data.status === 'COMPLETED', JSON.stringify(ver.data));
ok('setelah di-ACC admin, user bisa pesan lagi', (await order(j3, 6)).status === 201);
