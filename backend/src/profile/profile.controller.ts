import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, HttpException, NotFoundException, Patch, Put, Request, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isJpegDataUrl } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { IG_RE, NAME_COOLDOWN_MS, PHONE_RE, cleanIg, cleanPhone } from './profile-rules';

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(100) fullName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) instagram?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}
class AvatarDto {
  @IsString() @MaxLength(200_000) image!: string;
}

/** Kirim foto profil sebagai JPEG (dipakai profil sendiri dan tampilan admin). */
export function sendAvatar(res: Response, image?: string) {
  if (!image) throw new NotFoundException('Foto profil tidak ada');
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' }).send(Buffer.from(image.split(',')[1], 'base64'));
}

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private prisma: PrismaService) {}

  private async view(id: bigint) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: { role: true, avatar: { select: { updatedAt: true } } } });
    const next = u.nameChangedAt ? new Date(u.nameChangedAt.getTime() + NAME_COOLDOWN_MS) : null;
    return {
      email: u.email, fullName: u.fullName, phone: u.phone, instagram: u.instagram, address: u.address, role: u.role.name,
      avatarUrl: u.avatar ? `/api/profile/avatar?v=${u.avatar.updatedAt.getTime()}` : null,
      nameChangeAvailableAt: next && next > new Date() ? next.toISOString() : null,
    };
  }

  @Get() @SkipThrottle() get(@Request() req: any) { return this.view(BigInt(req.user.sub)); }

  @Patch()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async update(@Request() req: any, @Body() d: UpdateProfileDto) {
    const id = BigInt(req.user.sub);
    const data: Prisma.UserUpdateInput = {};
    if (d.phone !== undefined) {
      const p = cleanPhone(d.phone);
      if (p && !PHONE_RE.test(p)) throw new BadRequestException('Nomor telepon tidak valid (contoh 081234567890)');
      data.phone = p || null;
    }
    if (d.instagram !== undefined) {
      const ig = cleanIg(d.instagram);
      if (ig && !IG_RE.test(ig)) throw new BadRequestException('Nama Instagram hanya huruf, angka, titik, dan garis bawah (maks. 30)');
      data.instagram = ig || null;
    }
    if (d.address !== undefined) data.address = d.address.trim() || null;
    if (d.fullName !== undefined) {
      const name = d.fullName.trim();
      const cur = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: { fullName: true, nameChangedAt: true } });
      if (name !== cur.fullName) {
        if (name.length < 2) throw new BadRequestException('Nama minimal 2 karakter');
        const cutoff = new Date(Date.now() - NAME_COOLDOWN_MS);
        // Atomik: dua permintaan bersamaan tidak bisa sama-sama mengganti nama.
        const r = await this.prisma.user.updateMany({ where: { id, OR: [{ nameChangedAt: null }, { nameChangedAt: { lt: cutoff } }] }, data: { fullName: name, nameChangedAt: new Date() } });
        if (r.count !== 1) {
          const when = cur.nameChangedAt ? new Date(cur.nameChangedAt.getTime() + NAME_COOLDOWN_MS).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '';
          throw new HttpException(`Nama hanya dapat diganti seminggu sekali. Bisa diganti lagi pada ${when}.`, 429);
        }
      }
    }
    if (Object.keys(data).length) await this.prisma.user.update({ where: { id }, data });
    return this.view(id);
  }

  @Put('avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async setAvatar(@Request() req: any, @Body() d: AvatarDto) {
    if (!isJpegDataUrl(d.image, 200_000)) throw new BadRequestException('Foto harus berupa gambar JPEG yang valid (maks. sekitar 150 KB setelah dikecilkan)');
    const userId = BigInt(req.user.sub);
    await this.prisma.userAvatar.upsert({ where: { userId }, create: { userId, image: d.image }, update: { image: d.image } });
    return this.view(userId);
  }

  @Delete('avatar')
  @HttpCode(200)
  async removeAvatar(@Request() req: any) {
    const userId = BigInt(req.user.sub);
    await this.prisma.userAvatar.deleteMany({ where: { userId } });
    return this.view(userId);
  }

  @Get('avatar')
  @Header('X-Content-Type-Options', 'nosniff')
  async avatar(@Request() req: any, @Res() res: Response) {
    const a = await this.prisma.userAvatar.findUnique({ where: { userId: BigInt(req.user.sub) } });
    sendAvatar(res, a?.image);
  }
}
