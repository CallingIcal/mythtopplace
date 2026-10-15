import { Controller, Get, Header, Param } from '@nestjs/common';
import { CatalogCache } from '../common/cache';
import { ParseBigIntPipe, finalPrice, plain } from '../common/helpers';
import { adminFee, paymentDetails } from '../payments.config';
import { PrismaService } from '../prisma/prisma.service';

@Controller('games')
export class GamesController {
  constructor(private prisma: PrismaService, private cache: CatalogCache) {}

  /** Semua game, termasuk yang nonaktif: UI menampilkannya sebagai "Sedang tidak tersedia". */
  @Get()
  @Header('Cache-Control', 'public, max-age=5')
  async list() {
    return this.cache.get('games', 5_000, async () => plain(await this.prisma.game.findMany({ orderBy: { name: 'asc' } })));
  }

  @Get('payments')
  @Header('Cache-Control', 'public, max-age=10')
  async payments() {
    return this.cache.get('payments', 10_000, async () => {
      const rows = await this.prisma.payment.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
      return { adminFee: adminFee(), methods: rows.map((p) => ({ id: p.id, name: p.name, ...paymentDetails(p.name) })) };
    });
  }

  @Get(':id/stocks')
  @Header('Cache-Control', 'public, max-age=2')
  async stocks(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.cache.get(`stocks:${id}`, 3_000, async () => {
      const game = await this.prisma.game.findUnique({ where: { id }, include: { stocks: { orderBy: { price: 'asc' } } } });
      if (!game) return [];
      return plain(game.stocks.map((s) => ({
        ...s,
        finalPrice: finalPrice(Number(s.price), s.discountPercent),
        available: game.isActive && s.isActive && s.stock > 0,
      })));
    });
  }
}
