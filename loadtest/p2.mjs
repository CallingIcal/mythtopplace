import { call, pool, tally, sql, log, ok, ADMIN } from './lib.mjs';
log('== P2: akun duplikat dan input berbahaya ==');
const RUN = Date.now();
const pw = 'Rahasia123x';
const base = { fullName: 'Budi Santoso', password: pw };
const first = await call('POST', '/auth/register', { body: { ...base, email: `dup${RUN}@loadtest.test` } });
ok('daftar email baru', first.status === 201);
const same = await call('POST', '/auth/register', { body: { ...base, email: `dup${RUN}@loadtest.test` } });
ok('email sama ditolak (409)', same.status === 409, same.data?.message);
const upper = await call('POST', '/auth/register', { body: { ...base, email: ` DUP${RUN}@LoadTest.TEST ` } });
ok('email sama beda huruf besar/spasi ditolak (409)', upper.status === 409, `status ${upper.status}`);
const sameName = await call('POST', '/auth/register', { body: { ...base, email: `dup2${RUN}@loadtest.test` } });
log(`INFO nama lengkap yang sama (email berbeda): status ${sameName.status} -> ${sameName.status === 201 ? 'DIIZINKAN (nama bukan identitas unik)' : 'ditolak'}`);
const race = await Promise.all(Array.from({ length: 20 }, () => call('POST', '/auth/register', { body: { ...base, email: `race${RUN}@loadtest.test` } })));
const t = Object.entries(Object.entries(race.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {}))).map(([k, v]) => `${v[0]}:${v[1]}`).join(' ');
ok('20 pendaftaran bersamaan email sama: tepat 1 berhasil', race.filter((r) => r.status === 201).length === 1 && race.every((r) => [201, 409].includes(r.status)), t);
ok('DB hanya 1 akun untuk email itu', Number(sql('select count(*) from User where email="race${RUN}@loadtest.test"')) === 1);
const bad = [
  ['email tanpa titik', { email: 'budi@gmail' }], ['email tanpa @', { email: 'budi.gmail.com' }],
  ['sandi semua huruf kecil', { email: 'a1@loadtest.test', password: 'rahasia123' }], ['sandi < 8', { email: 'a2@loadtest.test', password: 'Ab1' }],
  ['sandi tanpa angka', { email: 'a3@loadtest.test', password: 'Rahasiaaaa' }], ['sandi tanpa huruf besar', { email: 'a4@loadtest.test', password: 'rahasia123' }],
  ['mass-assignment role ADMIN', { email: 'a5@loadtest.test', role: 'ADMIN' }], ['mass-assignment roleId', { email: 'a6@loadtest.test', roleId: 2 }],
];
for (const [name, o] of bad) { const r = await call('POST', '/auth/register', { body: { ...base, ...o } }); ok(`ditolak: ${name}`, r.status === 400, `status ${r.status} ${JSON.stringify(r.data?.message)?.slice(0, 80)}`); }
const sqli = await call('POST', '/auth/register', { body: { fullName: "x'); DROP TABLE User;--", email: `a'--${RUN}@loadtest.test`, password: pw } });
ok('payload SQL injection di email ditolak (400) / tidak merusak DB', [400, 201].includes(sqli.status) && Number(sql('select count(*) from User')) > 0, `status ${sqli.status}`);
const sqli2 = await call('POST', '/auth/login', { body: { email: "admin' OR '1'='1", password: "' OR '1'='1" } });
ok('login SQL injection tidak lolos', sqli2.status === 400 || sqli2.status === 401, `status ${sqli2.status}`);
const xss = await call('POST', '/auth/register', { body: { fullName: '<script>alert(1)</script>', email: 'xss@loadtest.test', password: pw } });
log(`INFO nama berisi <script>: status ${xss.status} (disimpan sebagai teks; React meng-escape saat ditampilkan)`);
const admin = await call('POST', '/auth/register', { body: { fullName: 'x', email: ADMIN.email, password: pw } });
ok('email admin tidak bisa didaftarkan ulang', admin.status === 409 || admin.status === 400, `status ${admin.status}`);
