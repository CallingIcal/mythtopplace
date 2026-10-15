import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isJpegDataUrl, retry } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

const MSG_SELECT = { id: true, fromAdmin: true, body: true, hasImage: true, transactionId: true, createdAt: true, transaction: { select: { invoiceNo: true } } } as const;
const OPTS = { maxWait: 20_000, timeout: 20_000 };

export const msgView = (m: any, base: string) => ({
  id: m.id.toString(), fromAdmin: m.fromAdmin, body: m.body,
  imageUrl: m.hasImage ? `${base}/${m.id}/image` : null,
  transactionId: m.transactionId?.toString() ?? null, invoiceNo: m.transaction?.invoiceNo ?? null, createdAt: m.createdAt.toISOString(),
});

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  /** Pesan sebuah percakapan: terbaru 100, atau yang lebih baru dari `after` (untuk polling ringan). */
  async list(userId: bigint, base: string, after?: string) {
    const rows = after && /^\d{1,18}$/.test(after)
      ? await this.prisma.chatMessage.findMany({ where: { userId, id: { gt: BigInt(after) } }, orderBy: { id: 'asc' }, take: 200, select: MSG_SELECT })
      : (await this.prisma.chatMessage.findMany({ where: { userId }, orderBy: { id: 'desc' }, take: 100, select: MSG_SELECT })).reverse();
    return rows.map((m) => msgView(m, base));
  }

  async send(userId: bigint, fromAdmin: boolean, base: string, d: { body?: string; image?: string; transactionId?: string }) {
    const body = (d.body ?? '').trim();
    if (!body && !d.image) throw new BadRequestException('Tulis pesan atau lampirkan foto');
    if (d.image && !isJpegDataUrl(d.image, 250_000)) throw new BadRequestException('Foto harus berupa gambar JPEG yang valid');
    const preview = (body || '[Foto]').slice(0, 120);
    // Percakapan dibuat lebih dulu di luar transaksi (idempoten) agar pesan pertama yang bersamaan tidak saling mengunci.
    await this.prisma.chatThread.createMany({ data: [{ userId }], skipDuplicates: true });
    const m = await retry(() => this.prisma.$transaction(async (db) => {
      let transactionId: bigint | null = null;
      if (d.transactionId) {
        const t = await db.transaction.findFirst({ where: { id: BigInt(d.transactionId), userId }, select: { id: true } });
        if (!t) throw new BadRequestException('Pesanan yang dirujuk tidak ditemukan');
        transactionId = t.id;
      }
      // Urutan penting: kunci baris percakapan (UPDATE) lebih dulu, baru sisipkan pesan. Pengirim bersamaan jadi antre, tidak deadlock.
      await db.chatThread.update({
        where: { userId },
        data: { lastMessageAt: new Date(), lastPreview: preview, ...(fromAdmin ? { userUnread: { increment: 1 } } : { adminUnread: { increment: 1 } }) },
      });
      return db.chatMessage.create({ data: { userId, fromAdmin, body, image: d.image ?? null, hasImage: !!d.image, transactionId }, select: MSG_SELECT });
    }, OPTS));
    return msgView(m, base);
  }

  async image(userId: bigint, id: bigint) {
    const m = await this.prisma.chatMessage.findFirst({ where: { id, userId }, select: { image: true } });
    if (!m?.image) throw new NotFoundException('Foto tidak ada');
    return m.image;
  }

  markRead(userId: bigint, asAdmin: boolean) {
    return this.prisma.chatThread.updateMany({ where: { userId }, data: asAdmin ? { adminUnread: 0 } : { userUnread: 0 } });
  }
}
