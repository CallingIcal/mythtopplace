import { BadRequestException, HttpException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { Gate } from '../common/gate';
import { audit, finalPrice, isJpegDataUrl, paging, plain } from '../common/helpers';
import { adminFee, maxActiveOrders, pendingTtlMinutes } from '../payments.config';
import { PrismaService } from '../prisma/prisma.service';
import { validGameUserId } from './game-id';

export const TX_INCLUDE = {
  topupStock: { include: { game: true } }, payment: true, proof: { select: { transactionId: true } },
} as const;
/** Ubah hasil query menjadi JSON aman; bukti bayar hanya ditandai (hasProof), isinya diambil terpisah. */
export const shape = (t: any) => {
  const { proof, ...rest } = t;
  const expiresAt = t.status === 'PENDING' ? new Date(new Date(t.createdAt).getTime() + pendingTtlMinutes() * 60_000) : null;
  return plain({ ...rest, hasProof: !!proof, expiresAt });
};

// Batasi pembuatan pesanan yang berjalan bersamaan (di bawah ukuran pool koneksi) agar antrean koneksi tidak kehabisan.
const orderGate = new Gate(Number(process.env.DB_WRITE_CONCURRENCY || 8), Number(process.env.ORDER_QUEUE || 5000));
const TX_OPTS = { maxWait: 20_000, timeout: 20_000 };
const FILTERS: Record<string, TransactionStatus[]> = { active: ['PENDING', 'PROCESSING'], done: ['COMPLETED'], closed: ['FAILED', 'CANCELLED'] };

@Injectable()
export class TransactionsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.expire(pendingTtlMinutes()).catch(() => undefined), 15_000);
  }
  onModuleDestroy() { clearInterval(this.timer); }

  /** Batalkan pesanan PENDING yang melewati batas waktu dan kembalikan stoknya. */
  async expire(ttlMinutes: number) {
    const old = await this.prisma.transaction.findMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - ttlMinutes * 60_000) } },
      select: { id: true }, take: 100,
    });
    for (const t of old) await this.close(t.id, 'CANCELLED', ['PENDING']).catch(() => undefined);
  }

  /** Harga final dihitung di server (diskon + biaya admin); stok dipesan dalam satu transaksi database. */
  create(userId: bigint, dto: { topupStockId: number; gameUserId: string; paymentId: number }) {
    return orderGate.run(() => this.createNow(userId, dto));
  }

  private async createNow(userId: bigint, dto: { topupStockId: number; gameUserId: string; paymentId: number }) {
    const payment = await this.prisma.payment.findFirst({ where: { id: dto.paymentId, isActive: true } });
    if (!payment) throw new BadRequestException('Metode pembayaran tidak tersedia');
    const stockId = BigInt(dto.topupStockId);
    const gameUserId = dto.gameUserId.trim();
    const tx = await this.prisma.$transaction(async (db) => {
      // Kunci baris user agar dua permintaan bersamaan tidak sama-sama lolos batas transaksi berjalan.
      await db.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
      const limit = maxActiveOrders();
      if ((await db.transaction.count({ where: { userId, status: { in: ['PENDING', 'PROCESSING'] } } })) >= limit) {
        throw new HttpException(`Maksimal ${limit} transaksi berjalan. Tunggu transaksi sebelumnya selesai atau disetujui admin.`, 429);
      }
      const item = await db.topupStock.findUnique({ where: { id: stockId }, include: { game: true } });
      if (!item || !item.isActive || !item.game.isActive) throw new BadRequestException('Pilihan ini sedang tidak tersedia');
      if (!validGameUserId(item.game.slug, gameUserId)) {
        throw new BadRequestException(item.game.slug === 'roblox' ? 'Isi nama dan username Roblox dengan benar' : 'ID game tidak valid');
      }
      const r = await db.topupStock.updateMany({ where: { id: stockId, isActive: true, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
      if (r.count !== 1) throw new BadRequestException('Pilihan ini sedang tidak tersedia atau stok habis');
      const fee = adminFee();
      return db.transaction.create({
        data: {
          invoiceNo: `INV-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
          userId, topupStockId: stockId, gameUserId, paymentId: payment.id,
          amount: finalPrice(Number(item.price), item.discountPercent) + fee, adminFee: fee,
          listPrice: item.price, discountPercent: item.discountPercent,
        },
        include: TX_INCLUDE,
      });
    }, TX_OPTS);
    return shape(tx);
  }

  async mine(userId: bigint, page?: string, filter?: string) {
    const p = paging(page);
    if (filter && !FILTERS[filter]) throw new BadRequestException('Filter tidak valid');
    const where = { userId, ...(filter ? { status: { in: FILTERS[filter] } } : {}) };
    // Dua query paralel biasa (bukan $transaction) agar tidak memakan koneksi khusus transaksi saat ramai.
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({ where, include: TX_INCLUDE, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: items.map(shape), total, page: p.page, pageSize: p.pageSize };
  }

  /** Detail lengkap satu transaksi milik user (tetap bisa dibuka setelah selesai). */
  async detail(userId: bigint, id: bigint) {
    const t = await this.prisma.transaction.findFirst({ where: { id, userId }, include: TX_INCLUDE });
    if (!t) throw new NotFoundException('Transaksi tidak ditemukan');
    return shape(t);
  }

  async proof(userId: bigint, id: bigint) {
    const p = await this.prisma.transactionProof.findFirst({ where: { transactionId: id, transaction: { userId } } });
    if (!p) throw new NotFoundException('Bukti tidak ada');
    return { image: p.image };
  }

  /** Pembeli wajib menyertakan bukti: screenshot (JPEG) atau nomor pembayaran. Admin tetap yang memverifikasi. */
  async confirmPayment(userId: bigint, id: bigint, paymentRef?: string, proofImage?: string) {
    const ref = paymentRef?.trim() || null;
    if (!ref && !proofImage) throw new BadRequestException('Sertakan bukti pembayaran: screenshot atau nomor pembayaran');
    if (proofImage && !isJpegDataUrl(proofImage)) throw new BadRequestException('Bukti pembayaran harus berupa gambar yang valid');
    await this.prisma.$transaction(async (db) => {
      const r = await db.transaction.updateMany({ where: { id, userId, status: 'PENDING' }, data: { status: 'PROCESSING', paymentRef: ref, paidAt: new Date() } });
      if (r.count !== 1) throw new BadRequestException('Pesanan tidak menunggu pembayaran');
      if (proofImage) await db.transactionProof.create({ data: { transactionId: id, image: proofImage } });
    }, TX_OPTS);
    return shape(await this.prisma.transaction.findUniqueOrThrow({ where: { id }, include: TX_INCLUDE }));
  }

  /** Batal atau tolak: ubah status dan kembalikan stok yang dipesan, atomik. */
  close(id: bigint, to: 'CANCELLED' | 'FAILED', from: TransactionStatus[], who?: { userId?: bigint; adminId?: bigint }) {
    return this.prisma.$transaction(async (db) => {
      const tx = await db.transaction.findFirst({ where: { id, ...(who?.userId ? { userId: who.userId } : {}) } });
      if (!tx) throw new NotFoundException('Transaksi tidak ditemukan');
      const r = await db.transaction.updateMany({ where: { id, status: { in: from } }, data: { status: to, closedAt: new Date() } });
      if (r.count !== 1) throw new BadRequestException('Status transaksi tidak dapat diubah');
      await db.topupStock.update({ where: { id: tx.topupStockId }, data: { stock: { increment: 1 } } });
      if (who?.adminId) await audit(db, who.adminId, to === 'FAILED' ? 'REJECT_TRANSACTION' : 'CANCEL_TRANSACTION', 'TRANSACTION', id, tx.status, to);
      return { id: id.toString(), status: to };
    }, TX_OPTS);
  }
}
