import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionCache } from '../common/cache';
import { PrismaService } from '../prisma/prisma.service';
import { idleMinutes } from '../payments.config';
import { SESSION_COOKIE, readCookie } from './session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService, private sessions: SessionCache) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException('Sesi tidak valid');
    let sub: string, sid: string | undefined;
    try { ({ sub, sid } = this.jwt.verify(token)); }
    catch { throw new UnauthorizedException('Sesi berakhir'); }
    const ck = `${sub}:${sid}`;
    let user = this.sessions.get(ck);
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { id: BigInt(sub) }, include: { role: true } });
      if (user) this.sessions.set(ck, user);
    }
    if (!user || !user.isActive) throw new UnauthorizedException('Akun tidak aktif');
    if (!sid || user.sessionId !== sid) throw new UnauthorizedException('Akun ini masuk di perangkat lain. Silakan masuk lagi.');
    const idle = Date.now() - (user.lastSeenAt?.getTime() ?? 0);
    if (idle > idleMinutes() * 60_000) throw new UnauthorizedException(`Sesi berakhir karena tidak aktif selama ${idleMinutes()} menit`);
    // Aktivitas = permintaan yang mengubah data atau heartbeat. Polling GET tidak memperpanjang sesi.
    if (req.method !== 'GET' && idle > 30_000) {
      await this.prisma.user.updateMany({ where: { id: user.id, sessionId: sid }, data: { lastSeenAt: new Date() } });
      user.lastSeenAt = new Date();
    }
    req.user = { sub: user.id.toString(), email: user.email, role: user.role.name };
    return true;
  }
}
