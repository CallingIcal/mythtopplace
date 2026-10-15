import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaFilter } from './common/prisma.filter';
import { loadShed } from './common/loadshed';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: '600kb' }); // cukup untuk bukti bayar JPEG hasil kompres
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.use(loadShed(Number(process.env.MAX_INFLIGHT || 400), Number(process.env.MAX_QUEUE || 20000)));
  // Anti-CSRF: permintaan yang mengubah data wajib membawa header kustom (tidak bisa dikirim lintas situs tanpa CORS).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'mtp') {
      return res.status(403).json({ statusCode: 403, message: 'Permintaan tidak valid' });
    }
    next();
  });
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((v) => v.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new PrismaFilter());
  app.enableShutdownHooks();
  await app.init();
  const server = app.getHttpServer();
  server.requestTimeout = 30_000; // putus permintaan yang menggantung
  server.headersTimeout = 20_000;
  server.keepAliveTimeout = 65_000;
  server.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0', backlog: 4096 });
}
bootstrap();
