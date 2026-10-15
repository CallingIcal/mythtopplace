import { call, sql, log, ok, load, ADMIN } from './lib.mjs';
log('== P4: satu perangkat per akun, AFK 40 menit, heartbeat ==');
const users = load('users');
const u = users[3000]; // belum pernah login
const A = {}, B = {}, A2 = { cookie: undefined };
sql(`update User set sessionId=NULL, lastSeenAt=NULL where email='${u.email}'`);
const a = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, jar: A });
ok('perangkat A login', a.status === 200);
const b = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, jar: B });
ok('perangkat B (akun sama) ditolak 409', b.status === 409, b.data?.message);
ok('perangkat A tetap berfungsi', (await call('GET', '/auth/me', { jar: A })).status === 200);
const same = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, jar: A });
ok('login ulang dari perangkat yang sama (cookie masih ada) diizinkan', same.status === 200);
const oldCookie = A.cookie;
const afterLogout = await call('POST', '/auth/logout', { jar: A });
ok('logout sukses', afterLogout.status === 200);
ok('cookie lama tidak berlaku setelah logout', (await call('GET', '/auth/me', { jar: { cookie: oldCookie } })).status === 401);
const b2 = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, jar: B });
ok('setelah A keluar, perangkat B bisa login', b2.status === 200);
// kondisi balapan: 10 login bersamaan dari 10 perangkat berbeda
const v = users[3001]; sql(`update User set sessionId=NULL, lastSeenAt=NULL where email='${v.email}'`);
const race = await Promise.all(Array.from({ length: 10 }, () => call('POST', '/auth/login', { body: { email: v.email, password: v.password }, jar: {} })));
const wins = race.filter((r) => r.status === 200).length;
ok('10 login bersamaan dari 10 perangkat: tepat 1 yang masuk', wins === 1 && race.every((r) => [200, 409].includes(r.status)), `berhasil ${wins}, ditolak ${race.filter((r) => r.status === 409).length}`);
// AFK
const w = users[3002]; sql(`update User set sessionId=NULL, lastSeenAt=NULL where email='${w.email}'`);
const J = {}; await call('POST', '/auth/login', { body: { email: w.email, password: w.password }, jar: J });
sql(`update User set lastSeenAt = NOW(3) - INTERVAL 39 MINUTE where email='${w.email}'`);
const get39 = await call('GET', '/auth/me', { jar: J });
ok('AFK 39 menit: masih login', get39.status === 200);
const seenAfterGet = sql(`select TIMESTAMPDIFF(MINUTE, lastSeenAt, NOW(3)) from User where email='${w.email}'`);
ok('polling GET tidak memperpanjang sesi (lastSeenAt tetap ~39 menit lalu)', Number(seenAfterGet) >= 38, `selisih ${seenAfterGet} menit`);
const hb = await call('POST', '/auth/heartbeat', { jar: J });
const seenAfterHb = sql(`select TIMESTAMPDIFF(MINUTE, lastSeenAt, NOW(3)) from User where email='${w.email}'`);
ok('heartbeat (aktivitas) memperpanjang sesi', hb.status === 200 && Number(seenAfterHb) === 0, `selisih ${seenAfterHb} menit`);
sql(`update User set lastSeenAt = NOW(3) - INTERVAL 41 MINUTE where email='${w.email}'`);
await new Promise((r) => setTimeout(r, 6000)); // cache sesi server 5 detik
const get41 = await call('GET', '/auth/me', { jar: J });
ok('AFK 41 menit: otomatis keluar (401 + pesan tidak aktif)', get41.status === 401 && /tidak aktif/.test(get41.data?.message || ''), get41.data?.message);
const relog = await call('POST', '/auth/login', { body: { email: w.email, password: w.password }, jar: {} });
ok('setelah AFK-logout, akun bisa login lagi (perangkat apa pun)', relog.status === 200);
// admin dua perangkat: terbaru menang
const AD1 = {}, AD2 = {};
const r1 = await call('POST', '/auth/login', { body: { email: ADMIN.email, password: ADMIN.password }, jar: AD1 });
const r2 = await call('POST', '/auth/login', { body: { email: ADMIN.email, password: ADMIN.password }, jar: AD2 });
ok('admin bisa login di perangkat kedua (tidak terkunci dari panel)', r1.status === 200 && r2.status === 200);
ok('sesi admin lama otomatis tidak berlaku (tetap 1 perangkat aktif)', (await call('GET', '/admin/catalog', { jar: AD1 })).status === 401 && (await call('GET', '/admin/catalog', { jar: AD2 })).status === 200);
