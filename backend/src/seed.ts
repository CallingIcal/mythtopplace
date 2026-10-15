import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './common/password';

const prisma = new PrismaClient();
type Sample = [name: string, slug: string, unit: string, items: [string, number][]];

const SAMPLES: Sample[] = [
  ['Mobile Legends', 'mobile-legends', 'Diamonds', [['86 Diamonds', 15000], ['172 Diamonds', 29000]]],
  ['PUBG Mobile', 'pubg-mobile', 'UC', [['60 UC', 15000], ['325 UC', 70000]]],
  ['Clash of Clans', 'clash-of-clans', 'Gems', [['500 Gems', 30000], ['1200 Gems', 65000]]],
  ['Roblox', 'roblox', 'Robux', [['80 Robux', 15000], ['400 Robux', 65000]]],
];

const priceX = Number(process.env.SEED_PRICE_MULTIPLIER || 1); // pengali harga data contoh (hanya saat database masih kosong)

async function main() {
  const userRole = await prisma.role.upsert({ where: { name: 'USER' }, update: {}, create: { name: 'USER' } });
  const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || email.endsWith('@example.com') || email.startsWith('ganti-dengan') || password.includes('CHANGE_ME') || password.length < 8) {
    throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD (min. 8 karakter) wajib diisi dengan nilai nyata di .env');
  }
  const hash = await hashPassword(password);
  const sync = process.env.ADMIN_PASSWORD_SYNC === 'true';
  await prisma.user.upsert({
    where: { email },
    update: { roleId: adminRole.id, isActive: true, failedLogins: 0, lockedUntil: null, ...(sync ? { password: hash } : {}) },
    create: { email, fullName: 'Admin', password: hash, roleId: adminRole.id },
  });

  if (process.env.ADMIN_EXCLUSIVE !== 'false') {
    const demoted = await prisma.user.updateMany({ where: { roleId: adminRole.id, email: { not: email } }, data: { roleId: userRole.id } });
    if (demoted.count) console.log(`${demoted.count} admin lama diturunkan menjadi user (ADMIN_EXCLUSIVE)`);
  }
  console.log(`Admin siap: ${email} (sandi ${sync ? 'disinkronkan dari .env' : 'tidak diubah'})`);

  for (const name of ['QRIS', 'DANA', 'MANDIRI']) {
    await prisma.payment.upsert({ where: { name }, update: {}, create: { name } });
  }

  if ((await prisma.game.count()) === 0) {
    for (const [name, slug, unit, items] of SAMPLES) {
      await prisma.game.create({
        data: {
          name, slug, description: `Top up ${unit} ${name}`,
          stocks: { create: items.map(([q, price]) => ({ nominal: q, quantity: q, stock: 20, price: price * priceX })) },
        },
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
