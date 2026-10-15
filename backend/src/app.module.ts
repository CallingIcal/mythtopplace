import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { GamesController } from './games/games.controller';
import { TransactionsController } from './transactions/transactions.controller';
import { TransactionsService } from './transactions/transactions.service';
import { AdminController } from './admin/admin.controller';
import { HealthController } from './health.controller';
import { AdminChatController, ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { ProfileController } from './profile/profile.controller';
import { SESSION_HOURS } from './auth/session';
import { CatalogCache, SessionCache } from './common/cache';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret.includes('CHANGE_ME')) {
  throw new Error('JWT_SECRET wajib diisi dengan nilai acak minimal 32 karakter');
}

@Module({
  imports: [
    // 60 request per menit per IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MIN || 60) }]),
    JwtModule.register({ secret, signOptions: { expiresIn: `${SESSION_HOURS}h` as any } }),
  ],
  controllers: [HealthController, AuthController, GamesController, TransactionsController, AdminController, ProfileController, ChatController, AdminChatController],
  providers: [
    PrismaService, AuthService, TransactionsService, JwtAuthGuard, RolesGuard, CatalogCache, SessionCache, ChatService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
