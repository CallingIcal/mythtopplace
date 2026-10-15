// Server tiruan di browser untuk demo. Aturannya meniru backend NestJS (biaya admin, diskon, stok dipesan saat order,
// bukti bayar wajib, kunci akun, batas pesanan). Data hanya tersimpan di browser ini.
import { EMAIL_RE, GAME_ID_RE, ROBLOX_ID_RE, passwordError } from './policy';
import { HttpError } from './types';
import { IG_RE, PHONE_RE } from './policy';
import type { AuditLog, ChatMsg, Checkout, Game, Profile, Status, Stock, Thread, Tx } from './types';

type U = { id: string; email: string; fullName: string; password: string; role: 'USER' | 'ADMIN'; fails: number; lockedUntil: number; sid: string; seen: number; phone: string | null; instagram: string | null; address: string | null; nameChangedAt: number; avatar: string };
type T = { id: string; invoiceNo: string; userId: string; stockId: string; gameUserId: string; paymentId: number; amount: number; adminFee: number; status: Status; paymentRef: string | null; proof?: string; createdAt: number; listPrice: number; discountPercent: number; paidAt?: number; closedAt?: number; verifiedAt?: number; verifiedBy?: string };
type Msg = { id: string; fromAdmin: boolean; body: string; image?: string; txId?: string; at: number };
type Th = { msgs: Msg[]; userUnread: number; adminUnread: number; last: number; preview: string };
type DB = { users: U[]; games: Game[]; stocks: Stock[]; tx: T[]; audit: AuditLog[]; seq: number; chat: Record<string, Th> };

const KEY = 'mtp_mock_v8';
const NAME_COOLDOWN = 7 * 24 * 3600_000;
const blankProfile = { phone: null, instagram: null, address: null, nameChangedAt: 0, avatar: '' };
const IDLE = 40 * 60_000, TTL = 10 * 60_000, MAX_ACTIVE = 3;
// "Perangkat" = tab browser (sessionStorage): dua tab dengan akun yang sama meniru dua perangkat.
let memSid = '';
const getSid = () => { try { return sessionStorage.getItem('mtp_mock_sid') || ''; } catch { return memSid; } };
const setSid = (v: string) => { memSid = v; try { if (v) sessionStorage.setItem('mtp_mock_sid', v); else sessionStorage.removeItem('mtp_mock_sid'); } catch { /* abaikan */ } };
let touch = false;
const FEE = 1500;
// Data demo. Nilai asli diisi lewat frontend/.env.mock.local (tidak di-commit); bila kosong dipakai nilai contoh.
const ENV = (import.meta.env ?? {}) as Record<string, string | undefined>;
// Harga demo dikalikan agar tidak ada yang tertarik membeli (nilai dari .env.mock).
const PRICE_X = Number(ENV.VITE_MOCK_PRICE_MULTIPLIER || 1);
const MOCK_ADMIN = String(ENV.VITE_MOCK_ADMIN_EMAIL || 'admin@demo.test');
const MOCK_MANDIRI = { name: String(ENV.VITE_MOCK_MANDIRI_NAME || 'NAMA PEMILIK'), number: String(ENV.VITE_MOCK_MANDIRI_NUMBER || '0000000000000') };
const MOCK_DANA = String(ENV.VITE_MOCK_DANA_NUMBER || '081200000000');
const CHECKOUT: Checkout = {
  adminFee: FEE,
  methods: [
    { id: 1, name: 'QRIS', kind: 'qris', bankName: null, accountName: null, accountNumber: null },
    { id: 2, name: 'DANA', kind: 'ewallet', bankName: 'DANA', accountName: null, accountNumber: MOCK_DANA },
    { id: 3, name: 'MANDIRI', kind: 'bank', bankName: 'Bank Mandiri', accountName: MOCK_MANDIRI.name, accountNumber: MOCK_MANDIRI.number },
  ],
};
const finalPrice = (price: number, d: number) => Math.max(0, Math.round((price * (100 - d)) / 100));

function seed(): DB {
  const raw: [string, string, [string, number][]][] = [
    ['Mobile Legends', 'Diamonds', [['86 Diamonds', 15000], ['172 Diamonds', 29000]]],
    ['PUBG Mobile', 'UC', [['60 UC', 15000], ['325 UC', 70000]]],
    ['Clash of Clans', 'Gems', [['500 Gems', 30000], ['1200 Gems', 65000]]],
    ['Roblox', 'Robux', [['80 Robux', 15000], ['400 Robux', 65000]]],
  ];
  const games: Game[] = [], stocks: Stock[] = [];
  raw.forEach(([name, unit, items], i) => {
    const id = String(i + 1);
    games.push({ id, name, slug: name.toLowerCase().replace(/\s+/g, '-'), description: `Top up ${unit}`, isActive: true });
    items.forEach(([quantity, price]) => stocks.push({ id: String(stocks.length + 1), gameId: id, quantity, stock: 20, price: price * PRICE_X, isActive: true, discountPercent: 0 }));
  });
  // Sandi admin demo belum ada: sandi yang diketik pertama kali di browser ini menjadi sandi admin demo.
  return { users: [{ id: '1', email: MOCK_ADMIN, fullName: 'Admin', password: '', role: 'ADMIN', fails: 0, lockedUntil: 0, sid: '', seen: 0, ...blankProfile }], games, stocks, tx: [], audit: [], seq: 100, chat: {} };
}
function load(): DB { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* abaikan */ } return seed(); }
let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* abaikan */ } };

const err = (s: number, m: string) => new HttpError(m, s);
const need = () => {
  const sid = getSid();
  const u = sid ? db.users.find((x) => x.sid === sid) : undefined;
  if (!u) throw err(401, 'Sesi tidak valid');
  if (Date.now() - u.seen > IDLE) { u.sid = ''; save(); throw err(401, 'Sesi berakhir karena tidak aktif selama 40 menit'); }
  if (touch) { u.seen = Date.now(); save(); } // hanya aksi (non-GET) yang dihitung aktivitas, polling tidak
  return u;
};
const needAdmin = () => { const u = need(); if (u.role !== 'ADMIN') throw err(403, 'Hanya admin'); return u; };
const stockOf = (id: string) => db.stocks.find((s) => s.id === id)!;
const gameOf = (id: string) => db.games.find((g) => g.id === id)!;
const nextId = () => String(db.seq++);
const paged = <X,>(a: X[], p: number) => ({ items: a.slice((p - 1) * 20, p * 20), total: a.length, page: p, pageSize: 20 });
const log = (a: U, action: string, entityType: string, entityId: string, before?: string, after?: string) =>
  db.audit.unshift({ id: nextId(), action, entityType, entityId, statusBefore: before ?? null, statusAfter: after ?? null, createdAt: new Date().toISOString(), admin: { email: a.email } });
const stockView = (s: Stock): Stock => ({ ...s, finalPrice: finalPrice(s.price, s.discountPercent), available: gameOf(s.gameId).isActive && s.isActive && s.stock > 0 });

function view(t: T, withUser = false): Tx {
  const s = stockOf(t.stockId), u = db.users.find((x) => x.id === t.userId)!;
  return {
    id: t.id, invoiceNo: t.invoiceNo, gameUserId: t.gameUserId, amount: t.amount, adminFee: t.adminFee, hasProof: !!t.proof, status: t.status, paymentRef: t.paymentRef,
    createdAt: new Date(t.createdAt).toISOString(), expiresAt: t.status === 'PENDING' ? new Date(t.createdAt + TTL).toISOString() : null,
    listPrice: t.listPrice, discountPercent: t.discountPercent,
    paidAt: t.paidAt ? new Date(t.paidAt).toISOString() : null, verifiedAt: t.verifiedAt ? new Date(t.verifiedAt).toISOString() : null, closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : null,
    topupStock: { ...s, game: gameOf(s.gameId) }, payment: { id: t.paymentId, name: CHECKOUT.methods[t.paymentId - 1].name },
    ...(withUser ? { user: { fullName: u.fullName, email: u.email } } : {}),
  };
}
function release(t: T, to: 'CANCELLED' | 'FAILED', admin?: U) {
  const before = t.status;
  t.status = to; t.closedAt = Date.now(); stockOf(t.stockId).stock++;
  if (admin) log(admin, to === 'FAILED' ? 'REJECT_TRANSACTION' : 'CANCEL_TRANSACTION', 'TRANSACTION', t.id, before, to);
}
const expire = () => db.tx.forEach((t) => { if (t.status === 'PENDING' && Date.now() - t.createdAt > TTL) release(t, 'CANCELLED'); });
const profileView = (u: U): Profile => ({
  email: u.email, fullName: u.fullName, phone: u.phone, instagram: u.instagram, address: u.address, role: u.role, avatarUrl: u.avatar || null,
  nameChangeAvailableAt: u.nameChangedAt && u.nameChangedAt + NAME_COOLDOWN > Date.now() ? new Date(u.nameChangedAt + NAME_COOLDOWN).toISOString() : null,
});
const thread = (uid: string): Th => (db.chat[uid] ??= { msgs: [], userUnread: 0, adminUnread: 0, last: 0, preview: '' });
const msgView = (m: Msg, uid: string): ChatMsg => {
  const t = m.txId ? db.tx.find((x) => x.id === m.txId) : undefined;
  return { id: m.id, fromAdmin: m.fromAdmin, body: m.body, imageUrl: m.image || null, transactionId: m.txId ?? null, invoiceNo: t?.invoiceNo ?? null, createdAt: new Date(m.at).toISOString() };
};
const chatList = (uid: string, after?: string | null) => {
  const l = thread(uid).msgs;
  const rows = after ? l.filter((m) => Number(m.id) > Number(after)).slice(0, 200) : l.slice(-100);
  return rows.map((m) => msgView(m, uid));
};
function chatSend(uid: string, fromAdmin: boolean, b: any): ChatMsg {
  const body = String(b?.body ?? '').trim(), image = b?.image ? String(b.image) : '';
  if (body.length > 1000) throw err(400, 'Pesan maksimal 1000 karakter');
  if (!body && !image) throw err(400, 'Tulis pesan atau lampirkan foto');
  if (image && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length > 250_000)) throw err(400, 'Foto harus berupa gambar JPEG yang valid');
  let txId: string | undefined;
  if (b?.transactionId) { const t = db.tx.find((x) => x.id === String(b.transactionId) && x.userId === uid); if (!t) throw err(400, 'Pesanan yang dirujuk tidak ditemukan'); txId = t.id; }
  const th = thread(uid);
  const m: Msg = { id: nextId(), fromAdmin, body, image: image || undefined, txId, at: Date.now() };
  th.msgs.push(m); th.last = m.at; th.preview = (body || '[Foto]').slice(0, 120);
  if (fromAdmin) th.userUnread++; else th.adminUnread++;
  return msgView(m, uid);
}
const find = (id: string) => { const t = db.tx.find((x) => x.id === id); if (!t) throw err(404, 'Transaksi tidak ditemukan'); return t; };

export async function handle(method: string, path: string, body: any): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 40));
  touch = method !== 'GET';
  expire();
  const [p, qs] = path.split('?');
  const q = new URLSearchParams(qs || '');
  const page = Math.max(1, Number(q.get('page')) || 1);
  let m: RegExpMatchArray | null;
  const out = (v: unknown) => { save(); return v; };

  if (method === 'GET' && p === '/games') return db.games;
  if (method === 'GET' && p === '/games/payments') return CHECKOUT;
  if (method === 'GET' && (m = p.match(/^\/games\/(\d+)\/stocks$/))) return db.stocks.filter((s) => s.gameId === m![1]).sort((a, b) => a.price - b.price).map(stockView);

  if (method === 'POST' && p === '/auth/register') {
    const email = String(body.email || '').trim().toLowerCase(), name = String(body.fullName || '').trim(), pw = String(body.password || '');
    if (!EMAIL_RE.test(email)) throw err(400, 'Email harus mengandung @ dan titik');
    if (name.length < 2) throw err(400, 'Nama minimal 2 karakter');
    const weak = passwordError(pw);
    if (weak) throw err(400, weak);
    if (db.users.some((u) => u.email === email)) throw err(409, 'Email sudah terdaftar. Gunakan alamat email lain.');
    const u: U = { id: nextId(), email, fullName: name, password: pw, role: 'USER', fails: 0, lockedUntil: 0, sid: '', seen: 0, ...blankProfile };
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    u.sid = sid; u.seen = Date.now(); setSid(sid); db.users.push(u);
    return out({ user: { id: u.id, email, role: u.role } });
  }
  if (method === 'POST' && p === '/auth/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email === email);
    if (u && u.lockedUntil > Date.now()) throw err(429, 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    if (u && u.role === 'ADMIN' && u.password === '') {
      if (String(body.password || '').length < 6) throw err(400, 'Sandi admin demo minimal 6 karakter');
      u.password = String(body.password);
    }
    if (!u || u.password !== body.password) {
      if (u && ++u.fails >= 5) { u.fails = 0; u.lockedUntil = Date.now() + 15 * 60_000; }
      save(); throw err(401, 'Email atau password salah');
    }
    // Satu akun satu perangkat: user biasa ditolak jika sesi di perangkat lain masih aktif. Admin selalu boleh (sesi lama tergantikan).
    if (u.role === 'USER' && u.sid && u.sid !== getSid() && Date.now() - u.seen < IDLE) {
      throw err(409, 'Akun ini sedang masuk di perangkat lain. Keluar dari perangkat itu dulu, atau tunggu 40 menit tanpa aktivitas.');
    }
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    u.fails = 0; u.sid = sid; u.seen = Date.now(); setSid(sid);
    return out({ user: { id: u.id, email: u.email, role: u.role } });
  }
  if (method === 'POST' && p === '/auth/logout') { const sid = getSid(); const u = db.users.find((x) => x.sid === sid); if (u) u.sid = ''; setSid(''); return out({ ok: true }); }
  if (method === 'POST' && p === '/auth/heartbeat') { need(); return { ok: true }; }
  if (method === 'GET' && p === '/auth/me') { const u = need(); return { user: { id: u.id, email: u.email, role: u.role } }; }

  if (method === 'POST' && p === '/transactions') {
    const u = need();
    const s = db.stocks.find((x) => x.id === String(body.topupStockId));
    const gid = String(body.gameUserId || '').trim();
    if (!GAME_ID_RE.test(gid)) throw err(400, 'ID game tidak valid');
    if (!CHECKOUT.methods.some((x) => x.id === body.paymentId)) throw err(400, 'Metode pembayaran tidak tersedia');
    if (db.tx.filter((t) => t.userId === u.id && (t.status === 'PENDING' || t.status === 'PROCESSING')).length >= MAX_ACTIVE) throw err(429, `Maksimal ${MAX_ACTIVE} transaksi berjalan. Tunggu transaksi sebelumnya selesai atau disetujui admin.`);
    if (!s || !s.isActive || !gameOf(s.gameId).isActive) throw err(400, 'Pilihan ini sedang tidak tersedia');
    if (gameOf(s.gameId).slug === 'roblox' && !ROBLOX_ID_RE.test(gid)) throw err(400, 'Isi nama dan username Roblox dengan benar');
    if (s.stock < 1) throw err(400, 'Pilihan ini sedang tidak tersedia atau stok habis');
    s.stock--;
    const t: T = { id: nextId(), invoiceNo: `INV-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`, userId: u.id, stockId: s.id, gameUserId: gid, paymentId: body.paymentId, amount: finalPrice(s.price, s.discountPercent) + FEE, adminFee: FEE, status: 'PENDING', paymentRef: null, createdAt: Date.now(), listPrice: s.price, discountPercent: s.discountPercent };
    db.tx.unshift(t);
    return out(view(t));
  }
  if (method === 'GET' && p === '/transactions/mine') {
    const f = q.get('filter'), groups: Record<string, Status[]> = { active: ['PENDING', 'PROCESSING'], done: ['COMPLETED'], closed: ['FAILED', 'CANCELLED'] };
    if (f && !groups[f]) throw err(400, 'Filter tidak valid');
    return paged(db.tx.filter((t) => t.userId === need().id && (!f || groups[f].includes(t.status))).map((t) => view(t)), page);
  }
  if (method === 'GET' && (m = p.match(/^\/transactions\/(\d+)$/))) { const u = need(), t = db.tx.find((x) => x.id === m![1] && x.userId === u.id); if (!t) throw err(404, 'Transaksi tidak ditemukan'); return view(t); }
  if (method === 'GET' && (m = p.match(/^\/transactions\/(\d+)\/proof$/))) { const u = need(), t = db.tx.find((x) => x.id === m![1] && x.userId === u.id); if (!t?.proof) throw err(404, 'Bukti tidak ada'); return { image: t.proof }; }

  // Profil
  if (method === 'GET' && p === '/profile') return profileView(need());
  if (method === 'PATCH' && p === '/profile') {
    const u = need(), b = body ?? {};
    if (b.phone !== undefined) { const ph = String(b.phone).replace(/[\s-]/g, ''); if (ph && !PHONE_RE.test(ph)) throw err(400, 'Nomor telepon tidak valid (contoh 081234567890)'); u.phone = ph || null; }
    if (b.instagram !== undefined) { const ig = String(b.instagram).trim().replace(/^@/, ''); if (ig && !IG_RE.test(ig)) throw err(400, 'Nama Instagram hanya huruf, angka, titik, dan garis bawah (maks. 30)'); u.instagram = ig || null; }
    if (b.address !== undefined) { if (String(b.address).length > 300) throw err(400, 'Alamat maksimal 300 karakter'); u.address = String(b.address).trim() || null; }
    if (b.fullName !== undefined) {
      const name = String(b.fullName).trim();
      if (name !== u.fullName) {
        if (name.length < 2) throw err(400, 'Nama minimal 2 karakter');
        if (u.nameChangedAt && Date.now() - u.nameChangedAt < NAME_COOLDOWN) throw err(429, `Nama hanya dapat diganti seminggu sekali. Bisa diganti lagi pada ${new Date(u.nameChangedAt + NAME_COOLDOWN).toLocaleDateString('id-ID', { dateStyle: 'long' })}.`);
        u.fullName = name; u.nameChangedAt = Date.now();
      }
    }
    return out(profileView(u));
  }
  if (method === 'PUT' && p === '/profile/avatar') {
    const u = need(), img = String(body?.image ?? '');
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(img) || img.length > 200_000) throw err(400, 'Foto harus berupa gambar JPEG yang valid (maks. sekitar 150 KB setelah dikecilkan)');
    u.avatar = img; return out(profileView(u));
  }
  if (method === 'DELETE' && p === '/profile/avatar') { const u = need(); u.avatar = ''; return out(profileView(u)); }

  // Chat pembeli
  if (method === 'GET' && p === '/chat') return chatList(need().id, q.get('after'));
  if (method === 'GET' && p === '/chat/summary') return { unread: thread(need().id).userUnread };
  if (method === 'POST' && p === '/chat') return out(chatSend(need().id, false, body));
  if (method === 'POST' && p === '/chat/read') { thread(need().id).userUnread = 0; return out({ ok: true }); }
  if (method === 'POST' && (m = p.match(/^\/transactions\/(\d+)\/confirm-payment$/))) {
    const u = need(), t = find(m[1]);
    const ref = String(body?.paymentRef || '').trim().slice(0, 100) || null;
    const img = body?.proofImage ? String(body.proofImage) : '';
    if (!ref && !img) throw err(400, 'Sertakan bukti pembayaran: screenshot atau nomor pembayaran');
    if (img && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(img) || img.length > 400_000)) throw err(400, 'Bukti pembayaran harus berupa gambar yang valid');
    if (t.userId !== u.id || t.status !== 'PENDING') throw err(400, 'Pesanan tidak menunggu pembayaran');
    t.status = 'PROCESSING'; t.paidAt = Date.now(); t.paymentRef = ref; if (img) t.proof = img;
    return out(view(t));
  }
  if (method === 'POST' && (m = p.match(/^\/transactions\/(\d+)\/cancel$/))) {
    const u = need(), t = find(m[1]);
    if (t.userId !== u.id) throw err(404, 'Transaksi tidak ditemukan');
    if (t.status !== 'PENDING') throw err(400, 'Status transaksi tidak dapat diubah');
    release(t, 'CANCELLED'); return out({ id: t.id, status: t.status });
  }

  if (p.startsWith('/admin')) {
    const a = needAdmin();
    if (method === 'GET' && p === '/admin/transactions') {
      const st = q.get('status');
      return paged(db.tx.filter((t) => !st || t.status === st).map((t) => view(t, true)), page);
    }
    if (method === 'GET' && p === '/admin/chat/threads') {
      const items: Thread[] = Object.entries(db.chat).filter(([, th]) => th.msgs.length).sort((x, y) => y[1].last - x[1].last).map(([uid, th]) => {
        const u = db.users.find((x) => x.id === uid)!;
        return { userId: uid, fullName: u.fullName, email: u.email, avatarUrl: u.avatar || null, lastPreview: th.preview, lastMessageAt: new Date(th.last).toISOString(), unread: th.adminUnread };
      });
      return { items, total: items.length };
    }
    if (method === 'GET' && p === '/admin/chat/summary') return { unread: Object.values(db.chat).reduce((n, th) => n + th.adminUnread, 0) };
    if (method === 'GET' && (m = p.match(/^\/admin\/chat\/(\d+)$/))) return chatList(m[1], q.get('after'));
    if (method === 'POST' && (m = p.match(/^\/admin\/chat\/(\d+)$/))) { if (!db.users.some((x) => x.id === m![1])) throw err(400, 'Data terkait tidak valid'); return out(chatSend(m[1], true, body)); }
    if (method === 'POST' && (m = p.match(/^\/admin\/chat\/(\d+)\/read$/))) { thread(m[1]).adminUnread = 0; return out({ ok: true }); }
    if (method === 'GET' && (m = p.match(/^\/admin\/transactions\/(\d+)$/))) {
      const t = find(m[1]), u = db.users.find((x) => x.id === t.userId)!, v = t.verifiedBy ? db.users.find((x) => x.id === t.verifiedBy) : undefined;
      return { ...view(t, true), verifierEmail: v?.email ?? null, buyer: { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, instagram: u.instagram, address: u.address, avatarUrl: u.avatar || null } };
    }
    if (method === 'GET' && (m = p.match(/^\/admin\/transactions\/(\d+)\/proof$/))) {
      const t = find(m[1]); if (!t.proof) throw err(404, 'Bukti tidak ada'); return { image: t.proof };
    }
    if (method === 'PATCH' && (m = p.match(/^\/admin\/transactions\/(\d+)\/verify$/))) {
      const t = find(m[1]);
      if (t.status === 'COMPLETED') return { id: t.id, status: t.status };
      if (t.status !== 'PROCESSING') throw err(400, 'Transaksi belum siap diverifikasi');
      t.status = 'COMPLETED'; t.verifiedAt = Date.now(); t.verifiedBy = a.id; log(a, 'VERIFY_TRANSACTION', 'TRANSACTION', t.id, 'PROCESSING', 'COMPLETED');
      return out({ id: t.id, status: t.status });
    }
    if (method === 'PATCH' && (m = p.match(/^\/admin\/transactions\/(\d+)\/reject$/))) {
      const t = find(m[1]);
      if (t.status !== 'PENDING' && t.status !== 'PROCESSING') throw err(400, 'Status transaksi tidak dapat diubah');
      release(t, 'FAILED', a); return out({ id: t.id, status: t.status });
    }
    if (method === 'GET' && p === '/admin/catalog') return db.games.map((g) => ({ ...g, stocks: db.stocks.filter((s) => s.gameId === g.id).sort((x, y) => x.price - y.price) }));
    if (method === 'GET' && p === '/admin/audit-logs') return db.audit.slice(0, 50);
    if (method === 'POST' && p === '/admin/games') {
      const name = String(body.name || '').trim(), slug = String(body.slug || '');
      if (name.length < 2 || !/^[a-z0-9-]{2,120}$/.test(slug)) throw err(400, 'Slug hanya huruf kecil, angka, dan tanda hubung');
      if (db.games.some((g) => g.slug === slug)) throw err(409, 'Data sudah ada');
      const g: Game = { id: nextId(), name, slug, description: null, isActive: true };
      db.games.push(g); log(a, 'CREATE_GAME', 'GAME', g.id); return out(g);
    }
    if (method === 'PATCH' && (m = p.match(/^\/admin\/games\/(\d+)\/discount$/))) {
      const pct = Number(body.percent);
      if (!Number.isInteger(pct) || pct < 0 || pct > 90) throw err(400, 'Diskon 0 sampai 90 persen');
      const list = db.stocks.filter((s) => s.gameId === m![1]); list.forEach((s) => { s.discountPercent = pct; });
      log(a, 'DISCOUNT_GAME', 'GAME', m[1], undefined, `${pct}%`); return out({ updated: list.length });
    }
    if (method === 'PATCH' && (m = p.match(/^\/admin\/games\/(\d+)$/))) {
      const g = db.games.find((x) => x.id === m![1]); if (!g) throw err(404, 'Data tidak ditemukan');
      if (body.name !== undefined) { if (String(body.name).trim().length < 2) throw err(400, 'Nama game minimal 2 karakter'); g.name = String(body.name).trim(); }
      if (body.description !== undefined) g.description = String(body.description).slice(0, 500);
      if (body.isActive !== undefined) g.isActive = Boolean(body.isActive);
      log(a, 'UPDATE_GAME', 'GAME', g.id); return out(g);
    }
    if (method === 'POST' && p === '/admin/stocks') {
      const quantity = String(body.quantity || '').trim(), d = body.discountPercent ?? 0;
      if (!db.games.some((g) => g.id === body.gameId) || !quantity || !(body.price >= 1) || !(body.stock >= 0) || d < 0 || d > 90) throw err(400, 'Data nominal tidak valid');
      const s: Stock = { id: nextId(), gameId: body.gameId, quantity, stock: Math.floor(body.stock), price: body.price, isActive: true, discountPercent: Math.floor(d) };
      db.stocks.push(s); log(a, 'CREATE_STOCK', 'TOPUP_STOCK', s.id); return out(s);
    }
    if (method === 'PATCH' && (m = p.match(/^\/admin\/stocks\/(\d+)$/))) {
      const s = db.stocks.find((x) => x.id === m![1]); if (!s) throw err(404, 'Data tidak ditemukan');
      const d = body.discountPercent ?? s.discountPercent;
      if (!(body.price >= 1) || !(body.stock >= 0) || d < 0 || d > 90 || !String(body.quantity ?? s.quantity).trim()) throw err(400, 'Data nominal tidak valid');
      Object.assign(s, { quantity: String(body.quantity ?? s.quantity).trim(), stock: Math.floor(body.stock), price: body.price, discountPercent: Math.floor(d), isActive: Boolean(body.isActive) });
      log(a, 'UPDATE_STOCK', 'TOPUP_STOCK', s.id); return out(s);
    }
  }
  throw err(404, 'Endpoint tidak ditemukan');
}
