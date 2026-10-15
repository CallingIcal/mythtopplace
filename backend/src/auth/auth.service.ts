import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword } from '../common/password';
import { SessionCache } from '../common/cache';
import { idleMinutes } from '../payments.config';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_RE, normalizeEmail, validateUserPassword } from './password-policy';

const newSid = () => randomBytes(16).toString('hex');
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  // Hash pura-pura agar waktu respons login sama untuk email yang tidak ada (anti user-enumeration).
  private dummyHash = hashPassword('tidak-dipakai');
  constructor(private prisma: PrismaService, private jwt: JwtService, private sessions: SessionCache) {}

  async register(emailRaw: string, fullName: string, password: string) {
    const email = normalizeEmail(emailRaw);
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Email harus mengandung @ dan titik');
    const weak = validateUserPassword(password);
    if (weak) throw new BadRequestException(weak);
    const role = await this.prisma.role.findUnique({ where: { name: 'USER' } });
    if (!role) throw new InternalServerErrorException('Role USER belum di-seed');
    const taken = new ConflictException('Email sudah terdaftar. Gunakan alamat email lain.');
    if (await this.prisma.user.findUnique({ where: { email } })) throw taken;
    try {
      // Prisma memakai parameterized query: seluruh input diperlakukan sebagai DATA, bukan perintah SQL.
      const sid = newSid();
      const user = await this.prisma.user.create({
        data: { email, fullName, password: await hashPassword(password), roleId: role.id, sessionId: sid, lastSeenAt: new Date() },
        include: { role: true },
      });
      return this.session(user.id, user.email, user.role.name, sid);
    } catch (e: any) {
      if (e?.code === 'P2002') throw taken;
      throw e;
    }
  }

  /** Akun dikunci sementara setelah 5 kali salah password (melengkapi rate limit per IP). */
  async login(emailRaw: string, password: string, currentSid?: string) {
    const email = normalizeEmail(emailRaw);
    const user = await this.prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.', 429);
    }
    const ok = await verifyPassword(user?.password ?? (await this.dummyHash), password);
    if (!user || !user.isActive || !ok) {
      if (user) {
        const u = await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: { increment: 1 } } });
        if (u.failedLogins >= MAX_FAILS) {
          await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } });
        }
      }
      throw new UnauthorizedException('Email atau password salah');
    }
    // Satu akun, satu perangkat: user biasa ditolak jika masih ada sesi aktif di perangkat lain.
    // Admin selalu bisa masuk (sesi lama otomatis tidak berlaku) agar tidak terkunci dari panel.
    const sid = newSid();
    const cutoff = new Date(Date.now() - idleMinutes() * 60_000);
    const free: Prisma.UserWhereInput[] = [{ sessionId: null }, { lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }, ...(currentSid ? [{ sessionId: currentSid }] : [])];
    const claimed = await this.prisma.user.updateMany({
      where: user.role.name === 'ADMIN' ? { id: user.id } : { id: user.id, OR: free },
      data: { sessionId: sid, lastSeenAt: new Date(), failedLogins: 0, lockedUntil: null },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(`Akun ini sedang masuk di perangkat lain. Keluar dari perangkat itu dulu, atau tunggu ${idleMinutes()} menit tanpa aktivitas.`);
    }
    this.sessions.drop(user.id.toString());
    return this.session(user.id, user.email, user.role.name, sid);
  }

  /** Akhiri sesi di server (dipanggil saat user menekan Keluar atau AFK). */
  async logout(token?: string) {
    if (!token) return;
    try {
      const p = this.jwt.verify(token);
      await this.prisma.user.updateMany({ where: { id: BigInt(p.sub), sessionId: p.sid }, data: { sessionId: null, lastSeenAt: null } });
      this.sessions.drop(String(p.sub));
    } catch { /* token tidak valid: tidak ada yang perlu diakhiri */ }
  }

  sidOf(token?: string): string | undefined {
    if (!token) return undefined;
    try { return this.jwt.verify(token).sid; } catch { return undefined; }
  }

  private session(id: bigint, email: string, role: string, sid: string) {
    return { token: this.jwt.sign({ sub: id.toString(), sid }), user: { id: id.toString(), email, role } };
  }
}
