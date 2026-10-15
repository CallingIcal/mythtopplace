import { BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Patch, Post, Query, Request, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { sendAvatar } from '../profile/profile.controller';
import { TransactionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ParseBigIntPipe, audit, paging, plain } from '../common/helpers';
import { CatalogInvalidate } from './catalog-invalidate.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService, TX_INCLUDE, shape } from '../transactions/transactions.service';
import { CreateGameDto, CreateStockDto, DiscountDto, UpdateGameDto, UpdateStockDto } from './admin.dto';

const STATUSES = Object.values(TransactionStatus);

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CatalogInvalidate)
export class AdminController {
  constructor(private prisma: PrismaService, private txs: TransactionsService) {}

  @Get('transactions')
  async list(@Query('status') status?: string, @Query('page') page?: string) {
    if (status && !STATUSES.includes(status as TransactionStatus)) throw new BadRequestException('Status tidak valid');
    const p = paging(page);
    const where = status ? { status: status as TransactionStatus } : {};
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take,
        include: { ...TX_INCLUDE, user: { select: { id: true, email: true, fullName: true } } },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: items.map(shape), total, page: p.page, pageSize: p.pageSize };
  }

  /** Detail lengkap transaksi untuk admin: termasuk data pembeli dan admin yang memverifikasi. */
  @Get('transactions/:id')
  async detail(@Param('id', ParseBigIntPipe) id: bigint) {
    const t = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        ...TX_INCLUDE,
        user: { select: { id: true, email: true, fullName: true, phone: true, instagram: true, address: true, avatar: { select: { updatedAt: true } } } },
        verifier: { select: { email: true } },
      },
    });
    if (!t) throw new NotFoundException('Transaksi tidak ditemukan');
    const { user, verifier, ...rest } = t as any;
    return {
      ...shape(rest),
      verifierEmail: verifier?.email ?? null,
      buyer: {
        id: user.id.toString(), fullName: user.fullName, email: user.email, phone: user.phone, instagram: user.instagram, address: user.address,
        avatarUrl: user.avatar ? `/api/admin/users/${user.id}/avatar?v=${user.avatar.updatedAt.getTime()}` : null,
      },
    };
  }

  @Get('users/:id/avatar')
  @Header('X-Content-Type-Options', 'nosniff')
  async userAvatar(@Param('id', ParseBigIntPipe) id: bigint, @Res() res: Response) {
    const a = await this.prisma.userAvatar.findUnique({ where: { userId: id } });
    sendAvatar(res, a?.image);
  }

  /** Bukti bayar diambil per transaksi (tidak ikut daftar) agar daftar tetap ringan. */
  @Get('transactions/:id/proof')
  @Header('Cache-Control', 'private, no-store')
  async proof(@Param('id', ParseBigIntPipe) id: bigint) {
    const p = await this.prisma.transactionProof.findUnique({ where: { transactionId: id } });
    if (!p) throw new NotFoundException('Bukti tidak ada');
    return { image: p.image };
  }

  @Patch('transactions/:id/verify')
  async verify(@Param('id', ParseBigIntPipe) id: bigint, @Request() req: any) {
    const adminId = BigInt(req.user.sub);
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaksi tidak ditemukan');
    if (tx.status === 'COMPLETED') return { id: id.toString(), status: 'COMPLETED' };
    await this.prisma.$transaction(async (db) => {
      const r = await db.transaction.updateMany({
        where: { id, status: 'PROCESSING' },
        data: { status: 'COMPLETED', verifiedBy: adminId, verifiedAt: new Date() },
      });
      if (r.count !== 1) {
        // Kalah balapan dengan verifikasi lain: jika sudah COMPLETED, perlakukan sebagai sukses (idempoten).
        const now = await db.transaction.findUnique({ where: { id }, select: { status: true } });
        if (now?.status === 'COMPLETED') return;
        throw new BadRequestException('Transaksi belum siap diverifikasi');
      }
      await audit(db, adminId, 'VERIFY_TRANSACTION', 'TRANSACTION', id, 'PROCESSING', 'COMPLETED');
    }, { maxWait: 20_000, timeout: 20_000 });
    return { id: id.toString(), status: 'COMPLETED' };
  }

  @Patch('transactions/:id/reject')
  reject(@Param('id', ParseBigIntPipe) id: bigint, @Request() req: any) {
    return this.txs.close(id, 'FAILED', ['PENDING', 'PROCESSING'], { adminId: BigInt(req.user.sub) });
  }

  @Get('catalog')
  async catalog() {
    return plain(await this.prisma.game.findMany({ include: { stocks: { orderBy: { price: 'asc' } } }, orderBy: { name: 'asc' } }));
  }

  @Post('games')
  async createGame(@Body() d: CreateGameDto, @Request() req: any) {
    const adminId = BigInt(req.user.sub);
    return plain(await this.prisma.$transaction(async (db) => {
      const g = await db.game.create({ data: d });
      await audit(db, adminId, 'CREATE_GAME', 'GAME', g.id);
      return g;
    }));
  }

  @Patch('games/:id')
  async updateGame(@Param('id', ParseBigIntPipe) id: bigint, @Body() d: UpdateGameDto, @Request() req: any) {
    const adminId = BigInt(req.user.sub);
    return plain(await this.prisma.$transaction(async (db) => {
      const g = await db.game.update({ where: { id }, data: d });
      await audit(db, adminId, 'UPDATE_GAME', 'GAME', id);
      return g;
    }));
  }

  /** Diskon massal: semua nominal sebuah game. */
  @Patch('games/:id/discount')
  async discountGame(@Param('id', ParseBigIntPipe) id: bigint, @Body() d: DiscountDto, @Request() req: any) {
    const adminId = BigInt(req.user.sub);
    return this.prisma.$transaction(async (db) => {
      const r = await db.topupStock.updateMany({ where: { gameId: id }, data: { discountPercent: d.percent } });
      await audit(db, adminId, 'DISCOUNT_GAME', 'GAME', id, undefined, `${d.percent}%`);
      return { updated: r.count };
    });
  }

  @Post('stocks')
  async createStock(@Body() d: CreateStockDto, @Request() req: any) {
    const adminId = BigInt(req.user.sub);
    return plain(await this.prisma.$transaction(async (db) => {
      const s = await db.topupStock.create({ data: { gameId: BigInt(d.gameId), nominal: d.quantity, quantity: d.quantity, stock: d.stock, price: d.price, discountPercent: d.discountPercent ?? 0 } });
      await audit(db, adminId, 'CREATE_STOCK', 'TOPUP_STOCK', s.id);
      return s;
    }));
  }

  @Patch('stocks/:id')
  async updateStock(@Param('id', ParseBigIntPipe) id: bigint, @Body() d: UpdateStockDto, @Request() req: any) {
    const adminId = BigInt(req.user.sub);
    return plain(await this.prisma.$transaction(async (db) => {
      const s = await db.topupStock.update({ where: { id }, data: { ...d, ...(d.quantity ? { nominal: d.quantity } : {}) } });
      await audit(db, adminId, 'UPDATE_STOCK', 'TOPUP_STOCK', id);
      return s;
    }));
  }

  @Get('audit-logs')
  async auditLogs() {
    return plain(await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' }, take: 50, include: { admin: { select: { email: true } } },
    }));
  }
}
