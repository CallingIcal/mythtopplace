import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Ubah BigInt jadi string dan Decimal jadi number secara rekursif agar aman di-JSON. */
export function plain(v: any): any {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Prisma.Decimal) return v.toNumber();
  if (v === null || typeof v !== 'object' || v instanceof Date) return v;
  if (Array.isArray(v)) return v.map(plain);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
}

export function paging(page?: string, size?: string) {
  const p = Math.max(1, parseInt(page || '1', 10) || 1);
  const s = Math.min(50, Math.max(1, parseInt(size || '20', 10) || 20));
  return { page: p, pageSize: s, skip: (p - 1) * s, take: s };
}

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(v: string) {
    if (!/^\d{1,18}$/.test(v)) throw new BadRequestException('ID tidak valid');
    return BigInt(v);
  }
}

export const audit = (
  db: Prisma.TransactionClient, adminId: bigint, action: string, entityType: string,
  entityId: bigint, statusBefore?: string, statusAfter?: string,
) => db.auditLog.create({ data: { adminId, action, entityType, entityId, statusBefore, statusAfter } });

/** Harga setelah diskon persen, dibulatkan ke rupiah. */
export const finalPrice = (price: number, discountPercent: number) =>
  Math.max(0, Math.round((price * (100 - discountPercent)) / 100));

/** Bukti pembayaran harus JPEG asli (diperiksa dari header file), maksimal 400.000 karakter. */
export function isJpegDataUrl(s: string, max = 400_000) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(s);
  if (!m || s.length > max) return false;
  return Buffer.from(m[1].slice(0, 8), 'base64').subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
}

/** Ulangi otomatis jika database menolak karena deadlock/konflik tulis (P2034) saat banyak permintaan menyentuh baris yang sama. */
export async function retry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e: any) {
      if (e?.code !== 'P2034' || i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 40));
    }
  }
}
