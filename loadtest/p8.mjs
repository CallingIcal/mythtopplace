import { call, sql, log, ok, load, ADMIN } from './lib.mjs';
// P8: seluruh sistem admin + keselarasan harga admin vs user
log('== P8: sistem admin, harga, diskon, bukti, verifikasi/tolak ==');
sql('update TopupStock set stock=1000, isActive=1, discountPercent=0, price=15000 where id=1');
sql('update Game set isActive=1');
const users = load('users');
sql("update Transaction set status='CANCELLED' where status in ('PENDING','PROCESSING') and userId in (select id from User where email in ('user6000@loadtest.test','user6001@loadtest.test'))");
const mk = async (i) => { const jar = {}; sql(`update User set sessionId=NULL,lastSeenAt=NULL where email='${users[i].email}'`); const r = await call('POST', '/auth/login', { body: { email: users[i].email, password: users[i].password }, jar }); if (r.status !== 200) throw new Error('login ' + r.status); return jar; };
const adm = {}; await call('POST', '/auth/login', { body: { email: ADMIN.email, password: ADMIN.password }, jar: adm });
const buyer = await mk(6000), buyer2 = await mk(6001);
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/' + 'A'.repeat(2000) + '/9k=';
const order = (jar, stockId = 1, id = '12345678') => call('POST', '/transactions', { jar, body: { topupStockId: stockId, paymentId: 1, gameUserId: id } });

// akses
for (const [m, p] of [['GET', '/admin/transactions'], ['GET', '/admin/catalog'], ['GET', '/admin/audit-logs'], ['PATCH', '/admin/transactions/1/verify'], ['PATCH', '/admin/transactions/1/reject'], ['GET', '/admin/transactions/1/proof'], ['POST', '/admin/games'], ['PATCH', '/admin/games/1/discount'], ['POST', '/admin/stocks'], ['PATCH', '/admin/stocks/1']]) {
  const r = await call(m, p, { jar: buyer, body: m === 'GET' ? undefined : {} });
  ok(`user biasa ditolak 403: ${m} ${p}`, r.status === 403, `status ${r.status}`);
}
ok('tanpa login ditolak 401: /admin/catalog', (await call('GET', '/admin/catalog')).status === 401);

// harga & diskon selaras admin <-> user
const cases = [[15000, 0], [15000, 10], [29000, 33], [70000, 25], [65000, 90], [999, 7]];
let allMatch = true; const detail = [];
for (const [price, d] of cases) {
  const up = await call('PATCH', '/admin/stocks/1', { jar: adm, body: { price, discountPercent: d } });
  const user = (await call('GET', '/games/1/stocks')).data.find((s) => s.id === '1');
  const expected = Math.round(price * (100 - d) / 100);
  const o = await order(buyer2, 1, '87654321'); // butuh slot: batalkan setelahnya
  const match = up.status === 200 && user.price === price && user.discountPercent === d && user.finalPrice === expected && o.data?.amount === expected + 1500;
  detail.push(`${price}@${d}%->${user.finalPrice}/total ${o.data?.amount}`);
  if (!match) allMatch = false;
  if (o.status === 201) await call('POST', `/transactions/${o.data.id}/cancel`, { jar: buyer2 });
  const adminView = (await call('GET', '/admin/catalog', { jar: adm })).data.flatMap((g) => g.stocks).find((s) => s.id === '1');
  if (adminView.price !== price || adminView.discountPercent !== d) allMatch = false;
}
ok('harga/diskon di menu admin = tampilan user = total pesanan (6 kombinasi)', allMatch, detail.join(' | '));
// harga berubah setelah order tidak mengubah order lama
await call('PATCH', '/admin/stocks/1', { jar: adm, body: { price: 15000, discountPercent: 0 } });
const o1 = await order(buyer, 1, '11112222');
await call('PATCH', '/admin/stocks/1', { jar: adm, body: { price: 50000 } });
const mine = (await call('GET', '/transactions/mine', { jar: buyer })).data.items.find((t) => t.id === o1.data.id);
ok('mengubah harga tidak mengubah total pesanan yang sudah dibuat', mine.amount === 16500, `total tetap ${mine.amount}`);
await call('PATCH', '/admin/stocks/1', { jar: adm, body: { price: 15000 } });
// rename game & nominal terlihat di user
await call('PATCH', '/admin/games/1', { jar: adm, body: { name: 'Mobile Legends Baru', description: 'Deskripsi baru' } });
await call('PATCH', '/admin/stocks/1', { jar: adm, body: { quantity: 'Paket Spesial 86' } });
const games = (await call('GET', '/games')).data; const st = (await call('GET', '/games/1/stocks')).data.find((s) => s.id === '1');
ok('ganti nama game & nama nominal/gamepass tampil di user', games.find((g) => g.id === '1').name === 'Mobile Legends Baru' && st.quantity === 'Paket Spesial 86');
await call('PATCH', '/admin/games/1', { jar: adm, body: { name: 'Mobile Legends' } }); await call('PATCH', '/admin/stocks/1', { jar: adm, body: { quantity: '86 Diamonds' } });
// diskon massal
const bulk = await call('PATCH', '/admin/games/2/discount', { jar: adm, body: { percent: 20 } });
const s2 = (await call('GET', '/games/2/stocks')).data;
ok('diskon massal game: semua nominal terdampak & selaras', bulk.status === 200 && s2.every((s) => s.discountPercent === 20 && s.finalPrice === Math.round(s.price * 0.8)), JSON.stringify(s2.map((s) => s.finalPrice)));
ok('diskon > 90% ditolak 400', (await call('PATCH', '/admin/games/2/discount', { jar: adm, body: { percent: 95 } })).status === 400);
await call('PATCH', '/admin/games/2/discount', { jar: adm, body: { percent: 0 } });
// tambah game & nominal
const ng = await call('POST', '/admin/games', { jar: adm, body: { name: 'Game Baru', slug: 'game-baru-' + Date.now() } });
const ns = await call('POST', '/admin/stocks', { jar: adm, body: { gameId: ng.data.id, quantity: '100 Koin', stock: 5, price: 12345, discountPercent: 10 } });
const newStocks = (await call('GET', `/games/${ng.data.id}/stocks`)).data;
ok('tambah game + nominal baru tampil di user dengan harga benar', ng.status === 201 && ns.status === 201 && newStocks[0].finalPrice === Math.round(12345 * 0.9), JSON.stringify(newStocks[0]));
ok('slug duplikat ditolak 409', (await call('POST', '/admin/games', { jar: adm, body: { name: 'X2', slug: ng.data.slug } })).status === 409);
ok('slug berisi karakter berbahaya ditolak 400', (await call('POST', '/admin/games', { jar: adm, body: { name: 'X3', slug: "a'; drop" } })).status === 400);
// nonaktif -> tetap tampil, available=false, tidak bisa dipesan
await call('PATCH', '/admin/stocks/2', { jar: adm, body: { isActive: false } });
const off = (await call('GET', '/games/1/stocks')).data.find((s) => s.id === '2');
const offOrder = await order(buyer, 2);
ok('nominal nonaktif tetap tampil, available=false, pesanan ditolak', off && off.available === false && offOrder.status === 400, `available=${off?.available} order=${offOrder.status}`);
await call('PATCH', '/admin/stocks/2', { jar: adm, body: { isActive: true } });
await call('PATCH', '/admin/games/3', { jar: adm, body: { isActive: false } });
const gOff = (await call('GET', '/games')).data.find((g) => g.id === '3');
const gOrder = await order(buyer, 5);
ok('game nonaktif tampil (isActive=false) dan tidak bisa dipesan', gOff.isActive === false && gOrder.status === 400, `order=${gOrder.status}`);
await call('PATCH', '/admin/games/3', { jar: adm, body: { isActive: true } });
// verifikasi / tolak / bukti
const tA = await order(buyer, 1), tB = await order(buyer, 1);
const stockBefore = Number(sql('select stock from TopupStock where id=1'));
ok('bayar tanpa bukti ditolak 400', (await call('POST', `/transactions/${tA.data.id}/confirm-payment`, { jar: buyer, body: {} })).status === 400);
ok('bukti non-JPEG ditolak 400', (await call('POST', `/transactions/${tA.data.id}/confirm-payment`, { jar: buyer, body: { proofImage: 'data:image/jpeg;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') } })).status === 400);
const c1 = await call('POST', `/transactions/${tA.data.id}/confirm-payment`, { jar: buyer, body: { proofImage: JPEG, paymentRef: 'TRX-1' } });
ok('bukti screenshot + nomor diterima', c1.status === 201 || c1.status === 200, `status ${c1.status} hasProof=${c1.data?.hasProof}`);
const c2 = await call('POST', `/transactions/${tB.data.id}/confirm-payment`, { jar: buyer, body: { paymentRef: 'TRX-2' } });
ok('hanya nomor pembayaran diterima (tanpa SS)', (c2.status === 201 || c2.status === 200) && c2.data?.hasProof === false);
const list = (await call('GET', '/admin/transactions?status=PROCESSING', { jar: adm })).data;
const rowA = list.items.find((t) => t.id === tA.data.id), rowB = list.items.find((t) => t.id === tB.data.id);
ok('admin: hasProof=true untuk yang kirim SS, false untuk yang tidak (UI menulis "TIDAK TERDAPAT SS")', rowA?.hasProof === true && rowB?.hasProof === false);
const proof = await call('GET', `/admin/transactions/${tA.data.id}/proof`, { jar: adm });
ok('admin dapat mengambil isi screenshot (identik dengan yang dikirim)', proof.status === 200 && proof.data.image === JPEG);
ok('proof transaksi tanpa SS -> 404', (await call('GET', `/admin/transactions/${tB.data.id}/proof`, { jar: adm })).status === 404);
ok('list admin tidak membawa isi gambar (ringan)', !JSON.stringify(list).includes('/9j/4AAQ'));
const rej = await call('PATCH', `/admin/transactions/${tB.data.id}/reject`, { jar: adm });
ok('admin MENOLAK pembayaran -> FAILED', rej.status === 200 && rej.data.status === 'FAILED', JSON.stringify(rej.data));
ok('stok dikembalikan saat ditolak (+1)', Number(sql('select stock from TopupStock where id=1')) === stockBefore + 1);
const race = await Promise.all(Array.from({ length: 20 }, () => call('PATCH', `/admin/transactions/${tA.data.id}/verify`, { jar: adm })));
ok('20 verifikasi bersamaan transaksi sama: semua aman, status akhir COMPLETED', race.every((r) => r.status === 200) && sql(`select status from Transaction where id=${tA.data.id}`) === 'COMPLETED');
ok('audit log hanya 1 entri VERIFY untuk transaksi itu (tidak ganda)', Number(sql(`select count(*) from AuditLog where action='VERIFY_TRANSACTION' and entityId=${tA.data.id}`)) === 1);
ok('stok tidak berubah oleh verifikasi (sudah dipesan saat order)', Number(sql('select stock from TopupStock where id=1')) === stockBefore + 1);
ok('menolak transaksi yang sudah selesai -> 400', (await call('PATCH', `/admin/transactions/${tA.data.id}/reject`, { jar: adm })).status === 400);
const tC = await order(buyer, 1);
const rj = await call('PATCH', `/admin/transactions/${tC.data.id}/reject`, { jar: adm });
ok('admin menolak pesanan PENDING (belum bayar)', rj.status === 200 && rj.data.status === 'FAILED');
const vr = await call('PATCH', `/admin/transactions/${(await order(buyer, 1)).data.id}/verify`, { jar: adm });
ok('verifikasi pesanan PENDING (belum bayar) ditolak 400', vr.status === 400);
const race2 = await (async () => { const t = await order(buyer2, 1); await call('POST', `/transactions/${t.data.id}/confirm-payment`, { jar: buyer2, body: { paymentRef: 'R' } }); const before = Number(sql('select stock from TopupStock where id=1')); const rs = await Promise.all([...Array(10)].map(() => call('PATCH', `/admin/transactions/${t.data.id}/verify`, { jar: adm })).concat([...Array(10)].map(() => call('PATCH', `/admin/transactions/${t.data.id}/reject`, { jar: adm })))); return { rs, st: sql(`select status from Transaction where id=${t.data.id}`), before, after: Number(sql('select stock from TopupStock where id=1')) }; })();
const finalOk = (race2.st === 'COMPLETED' && race2.after === race2.before) || (race2.st === 'FAILED' && race2.after === race2.before + 1);
ok('balapan verify vs reject: hasil konsisten (stok sesuai status akhir)', finalOk && race2.rs.every((r) => r.status < 500), `status akhir ${race2.st}, stok ${race2.before}->${race2.after}`);
const audit = await call('GET', '/admin/audit-logs', { jar: adm });
ok('audit log berisi tindakan admin', audit.status === 200 && audit.data.length > 10, `${audit.data.length} entri`);
const f = await call('GET', '/admin/transactions?status=HACK', { jar: adm });
ok('filter status tidak valid ditolak 400 (bukan error SQL)', f.status === 400);
const big = await call('POST', `/transactions/${(await order(buyer2, 1)).data?.id ?? 0}/confirm-payment`, { jar: buyer2, body: { proofImage: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(700_000) } });
ok('bukti terlalu besar ditolak (413/400)', [400, 413].includes(big.status), `status ${big.status}`);
