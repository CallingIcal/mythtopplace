import * as mock from './mock';
import { HttpError } from './types';
import type { AuditLog, ChatMsg, Checkout, Game, Page, Profile, Stock, Thread, Tx, User } from './types';
export * from './types';

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const MOCK = Boolean(import.meta.env.VITE_MOCK);

/** Hanya cache data profil untuk render cepat. Token sesi ada di cookie HttpOnly, tidak terbaca JavaScript. */
export const session = {
  get user(): User | null { try { return JSON.parse(localStorage.getItem('mtp_user') || 'null'); } catch { return null; } },
  save(u: User) { try { localStorage.setItem('mtp_user', JSON.stringify(u)); } catch { /* abaikan */ } },
  clear() { try { localStorage.removeItem('mtp_user'); } catch { /* abaikan */ } },
};

async function send(method: string, path: string, body?: unknown): Promise<unknown> {
  if (MOCK) return mock.handle(method, path, body);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method, credentials: 'same-origin',
      headers: { 'X-Requested-With': 'mtp', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new HttpError('Tidak dapat terhubung ke server', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(Array.isArray(data.message) ? data.message[0] : data.message || 'Permintaan gagal', res.status);
  return data;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  try { return (await send(method, path, body)) as T; }
  catch (e) {
    const entering = path === '/auth/login' || path === '/auth/register';
    if (e instanceof HttpError && e.status === 401 && !entering && session.user) {
      session.clear();
      window.dispatchEvent(new Event('auth-expired'));
    }
    throw e;
  }
}

// Cache memori singkat agar perpindahan halaman terasa instan.
const memo = new Map<string, { t: number; v: unknown }>();
export const peek = <T>(key: string) => memo.get(key)?.v as T | undefined;
function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.v as T);
  return fn().then((v) => { memo.set(key, { t: Date.now(), v }); return v; });
}
const dropStocks = () => { for (const k of [...memo.keys()]) if (k.startsWith('stocks:')) memo.delete(k); };

export const getGames = () => cached('games', 10_000, () => request<Game[]>('GET', '/games'));
export const getPayments = () => cached('payments', 10_000, () => request<Checkout>('GET', '/games/payments'));
export const getStocks = (id: string) => cached(`stocks:${id}`, 5_000, () => request<Stock[]>('GET', `/games/${id}/stocks`));

export const register = (b: { fullName: string; email: string; password: string }) => request<{ user: User }>('POST', '/auth/register', b);
export const login = (b: { email: string; password: string }) => request<{ user: User }>('POST', '/auth/login', b);
export const logout = () => request('POST', '/auth/logout');
export const heartbeat = () => request('POST', '/auth/heartbeat');
export const me = () => request<{ user: User }>('GET', '/auth/me').then((r) => r.user);

export const createTransaction = (b: { topupStockId: number; gameUserId: string; paymentId: number }) => request<Tx>('POST', '/transactions', b).finally(dropStocks);
export const getMine = (page: number, filter = '') => request<Page<Tx>>('GET', `/transactions/mine?page=${page}${filter ? `&filter=${filter}` : ''}`);
export const getTx = (id: string) => request<Tx>('GET', `/transactions/${id}`);
export const myProof = (id: string) => request<{ image: string }>('GET', `/transactions/${id}/proof`);
export const adminTx = (id: string) => request<Tx>('GET', `/admin/transactions/${id}`);
export const confirmPayment = (id: string, b: { paymentRef: string; proofImage: string }) =>
  request<Tx>('POST', `/transactions/${id}/confirm-payment`, { paymentRef: b.paymentRef || undefined, proofImage: b.proofImage || undefined });
export const cancelTransaction = (id: string) => request('POST', `/transactions/${id}/cancel`).finally(dropStocks);

export const adminTransactions = (status: string, page: number) => request<Page<Tx>>('GET', `/admin/transactions?page=${page}${status ? `&status=${status}` : ''}`);
export const verifyTransaction = (id: string) => request('PATCH', `/admin/transactions/${id}/verify`);
export const rejectTransaction = (id: string) => request('PATCH', `/admin/transactions/${id}/reject`).finally(dropStocks);
export const adminCatalog = () => request<Game[]>('GET', '/admin/catalog');
export const createGame = (b: { name: string; slug: string }) => request('POST', '/admin/games', b).finally(() => memo.delete('games'));
export const updateGame = (id: string, b: { isActive?: boolean; name?: string; description?: string }) => request('PATCH', `/admin/games/${id}`, b).finally(() => memo.delete('games'));
export const createStock = (b: { gameId: string; quantity: string; stock: number; price: number; discountPercent?: number }) => request('POST', '/admin/stocks', b).finally(dropStocks);
export const updateStock = (id: string, b: { quantity?: string; stock?: number; price?: number; discountPercent?: number; isActive?: boolean }) => request('PATCH', `/admin/stocks/${id}`, b).finally(dropStocks);
export const adminProof = (id: string) => request<{ image: string }>('GET', `/admin/transactions/${id}/proof`);
export const discountGame = (id: string, percent: number) => request('PATCH', `/admin/games/${id}/discount`, { percent }).finally(dropStocks);
export const adminAudit = () => request<AuditLog[]>('GET', '/admin/audit-logs');

// Profil
export const getProfile = () => request<Profile>('GET', '/profile');
export const updateProfile = (b: Partial<{ fullName: string; phone: string; instagram: string; address: string }>) => request<Profile>('PATCH', '/profile', b);
export const setAvatar = (image: string) => request<Profile>('PUT', '/profile/avatar', { image });
export const removeAvatar = () => request<Profile>('DELETE', '/profile/avatar');

// Chat dengan admin
type Draft = { body?: string; image?: string; transactionId?: string };
export const getChat = (after?: string) => request<ChatMsg[]>('GET', `/chat${after ? `?after=${after}` : ''}`);
export const sendChat = (b: Draft) => request<ChatMsg>('POST', '/chat', b);
export const chatRead = () => request('POST', '/chat/read');
export const chatSummary = () => request<{ unread: number }>('GET', '/chat/summary');
export const adminThreads = () => request<{ items: Thread[]; total: number }>('GET', '/admin/chat/threads');
export const adminChat = (userId: string, after?: string) => request<ChatMsg[]>('GET', `/admin/chat/${userId}${after ? `?after=${after}` : ''}`);
export const adminSend = (userId: string, b: Draft) => request<ChatMsg>('POST', `/admin/chat/${userId}`, b);
export const adminChatRead = (userId: string) => request('POST', `/admin/chat/${userId}/read`);
export const adminChatSummary = () => request<{ unread: number }>('GET', '/admin/chat/summary');
