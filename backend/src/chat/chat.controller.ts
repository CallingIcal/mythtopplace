import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ParseBigIntPipe } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

export class SendChatDto {
  @IsOptional() @IsString() @MaxLength(1000) body?: string;
  @IsOptional() @IsString() @MaxLength(250_000) image?: string;
  @IsOptional() @Matches(/^\d{1,18}$/) transactionId?: string;
}
const sendJpeg = (res: Response, image: string) => res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' }).send(Buffer.from(image.split(',')[1], 'base64'));

/** Chat pembeli dengan admin: satu percakapan per user. */
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chat: ChatService, private prisma: PrismaService) {}
  private base = '/api/chat/messages';

  @Get() @SkipThrottle() list(@Request() req: any, @Query('after') after?: string) { return this.chat.list(BigInt(req.user.sub), this.base, after); }

  @Get('summary') @SkipThrottle()
  async summary(@Request() req: any) {
    const t = await this.prisma.chatThread.findUnique({ where: { userId: BigInt(req.user.sub) }, select: { userUnread: true } });
    return { unread: t?.userUnread ?? 0 };
  }

  @Post() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  send(@Request() req: any, @Body() d: SendChatDto) { return this.chat.send(BigInt(req.user.sub), false, this.base, d); }

  @Post('read') @HttpCode(200)
  async read(@Request() req: any) { await this.chat.markRead(BigInt(req.user.sub), false); return { ok: true }; }

  @Get('messages/:id/image') @Header('X-Content-Type-Options', 'nosniff')
  async image(@Request() req: any, @Param('id', ParseBigIntPipe) id: bigint, @Res() res: Response) {
    sendJpeg(res, await this.chat.image(BigInt(req.user.sub), id));
  }
}

/** Chat sisi admin: daftar percakapan dan balasan. */
@Controller('admin/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminChatController {
  constructor(private chat: ChatService, private prisma: PrismaService) {}
  private base = '/api/admin/chat/messages';

  @Get('threads') @SkipThrottle()
  async threads(@Query('page') page?: string) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const [rows, total] = await Promise.all([
      this.prisma.chatThread.findMany({
        orderBy: { lastMessageAt: 'desc' }, skip: (p - 1) * 30, take: 30,
        include: { user: { select: { id: true, fullName: true, email: true, avatar: { select: { updatedAt: true } } } } },
      }),
      this.prisma.chatThread.count(),
    ]);
    return {
      items: rows.map((t) => ({
        userId: t.userId.toString(), fullName: t.user.fullName, email: t.user.email, lastPreview: t.lastPreview,
        lastMessageAt: t.lastMessageAt.toISOString(), unread: t.adminUnread,
        avatarUrl: t.user.avatar ? `/api/admin/users/${t.userId}/avatar?v=${t.user.avatar.updatedAt.getTime()}` : null,
      })),
      total, page: p, pageSize: 30,
    };
  }

  @Get('summary') @SkipThrottle()
  async summary() {
    const r = await this.prisma.chatThread.aggregate({ _sum: { adminUnread: true } });
    return { unread: r._sum.adminUnread ?? 0 };
  }

  @Get(':userId') @SkipThrottle() list(@Param('userId', ParseBigIntPipe) userId: bigint, @Query('after') after?: string) { return this.chat.list(userId, `${this.base}/${userId}`, after); }

  @Post(':userId') send(@Param('userId', ParseBigIntPipe) userId: bigint, @Body() d: SendChatDto) { return this.chat.send(userId, true, `${this.base}/${userId}`, d); }

  @Post(':userId/read') @HttpCode(200)
  async read(@Param('userId', ParseBigIntPipe) userId: bigint) { await this.chat.markRead(userId, true); return { ok: true }; }

  @Get('messages/:userId/:id/image') @Header('X-Content-Type-Options', 'nosniff')
  async image(@Param('userId', ParseBigIntPipe) userId: bigint, @Param('id', ParseBigIntPipe) id: bigint, @Res() res: Response) {
    sendJpeg(res, await this.chat.image(userId, id));
  }
}
