import { Injectable } from '@nestjs/common';

/** Cache memori singkat dengan single-flight: ribuan permintaan serentak ke menu yang sama hanya memicu satu query database. */
@Injectable()
export class CatalogCache {
  private store = new Map<string, { exp: number; value?: unknown; inflight?: Promise<unknown> }>();

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    const now = Date.now();
    if (hit && hit.exp > now && hit.value !== undefined) return hit.value as T;
    if (hit?.inflight) return hit.inflight as Promise<T>;
    const inflight = load().then((value) => { this.store.set(key, { exp: Date.now() + ttlMs, value }); return value; })
      .catch((e) => { this.store.delete(key); throw e; });
    this.store.set(key, { exp: 0, inflight });
    return inflight;
  }

  /** Dipanggil saat admin mengubah katalog agar perubahan langsung terlihat user. */
  invalidate() { this.store.clear(); }
}

/** Cache validitas sesi 5 detik agar setiap klik tidak selalu memukul database. */
@Injectable()
export class SessionCache {
  private store = new Map<string, { exp: number; user: any }>();
  get(key: string) { const h = this.store.get(key); return h && h.exp > Date.now() ? h.user : undefined; }
  set(key: string, user: any) {
    if (this.store.size > 20_000) this.store.clear();
    this.store.set(key, { exp: Date.now() + 5_000, user });
  }
  drop(userId: string) { for (const k of this.store.keys()) if (k.startsWith(`${userId}:`)) this.store.delete(k); }
}
