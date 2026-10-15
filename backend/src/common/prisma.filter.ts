import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const map: Record<string, [number, string]> = {
      P2002: [409, 'Data sudah ada'],
      P2025: [404, 'Data tidak ditemukan'],
      P2003: [400, 'Data terkait tidak valid'],
    };
    const [statusCode, message] = map[e.code] ?? [500, 'Kesalahan server'];
    if (statusCode >= 500) console.error(`[prisma] ${e.code}: ${e.message.slice(0, 300)}`); // kode galat untuk diagnosa, tanpa dikirim ke klien
    host.switchToHttp().getResponse().status(statusCode).json({ statusCode, message });
  }
}
