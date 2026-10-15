import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';
export const BASE = process.env.LT_BASE || 'http://127.0.0.1:3000/api';
let ipSeq = Math.floor(Math.random() * 60000) + 1000;
export const nextIp = () => `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`;
export async function call(method, path, { body, jar, ip } = {}) {
  const headers = { 'X-Requested-With': 'mtp', 'X-Forwarded-For': ip ?? nextIp() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar?.cookie) headers.Cookie = jar.cookie;
  const t0 = performance.now();
  let res;
  try { res = await fetch(BASE + path, { method, headers, signal: AbortSignal.timeout(90000), body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { return { status: 0, error: String(e.cause?.code || e.message), ms: performance.now() - t0 }; }
  const sc = res.headers.get('set-cookie');
  if (sc && jar) jar.cookie = sc.split(';')[0];
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: res.status, data, ms: performance.now() - t0 };
}
export async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
export const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]) : 0; };
export const tally = (rs) => rs.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
export const sql = (q) => execSync(`mariadb topup_test -N -e "${q.replace(/"/g, '\\"')}"`).toString().trim();
export const rssMB = () => { try { const pid = readFileSync('/tmp/lt/server.pid', 'utf8').trim(); return Math.round(Number(execSync(`grep VmRSS /proc/${pid}/status | awk '{print $2}'`).toString()) / 1024); } catch { return -1; } };
export const log = (...a) => { const l = a.join(' '); console.log(l); appendFileSync('/tmp/lt/results.log', l + '\n'); };
export const ok = (name, cond, extra = '') => { log(cond ? 'PASS' : 'FAIL', name, extra); return cond; };
export const save = (f, d) => writeFileSync(`/tmp/lt/state/${f}.json`, JSON.stringify(d));
export const load = (f) => JSON.parse(readFileSync(`/tmp/lt/state/${f}.json`, 'utf8'));
export const has = (f) => existsSync(`/tmp/lt/state/${f}.json`);
export const alive = async () => (await call('GET', '/health', { ip: '127.9.9.9' })).status === 200;

// Akun admin untuk uji: isi lewat LT_ADMIN_EMAIL dan LT_ADMIN_PASSWORD (jangan ditulis di kode).
export const ADMIN = { email: process.env.LT_ADMIN_EMAIL || '', password: process.env.LT_ADMIN_PASSWORD || '' };
