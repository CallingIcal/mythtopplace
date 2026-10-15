import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { EMAIL_RE } from './password-policy';
import { SESSION_COOKIE, cookieOptions, readCookie } from './session';

const norm = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const LIMIT = { default: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_MIN || 5), ttl: 60_000 } }; // login & register: 5 percobaan per menit per IP

class RegisterDto {
  @Transform(norm) @Matches(EMAIL_RE, { message: 'Email harus mengandung @ dan titik' }) @MaxLength(190) email!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) fullName!: string;
  @IsString() @MaxLength(128) password!: string; // aturan sandi diperiksa di AuthService
}
class LoginDto {
  @Transform(norm) @IsString() @MaxLength(190) email!: string;
  @IsString() @MaxLength(128) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register') @Throttle(LIMIT)
  async register(@Body() d: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.register(d.email, d.fullName, d.password);
    res.cookie(SESSION_COOKIE, s.token, cookieOptions());
    return { user: s.user };
  }

  @Post('login') @HttpCode(200) @Throttle(LIMIT)
  async login(@Body() d: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.login(d.email, d.password, this.auth.sidOf(readCookie(req.headers.cookie, SESSION_COOKIE)));
    res.cookie(SESSION_COOKIE, s.token, cookieOptions());
    return { user: s.user };
  }

  @Post('logout') @HttpCode(200)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readCookie(req.headers.cookie, SESSION_COOKIE));
    const { maxAge, ...opts } = cookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
    return { ok: true };
  }

  /** Dikirim klien saat user aktif; memperpanjang sesi (guard memperbarui lastSeenAt untuk non-GET). */
  @Post('heartbeat') @HttpCode(200) @UseGuards(JwtAuthGuard)
  heartbeat() { return { ok: true }; }

  @Get('me') @SkipThrottle() @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return { user: { id: req.user.sub, email: req.user.email, role: req.user.role } };
  }
}
