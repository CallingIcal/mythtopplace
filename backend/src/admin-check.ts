import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from './common/password';

// Diagnosa akun admin tanpa menampilkan hash atau sandi: docker compose exec backend node dist/admin-check.js
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email) throw new Error('ADMIN_EMAIL belum diisi di .env');
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user) { console.log(`TIDAK ADA: ${email} belum terdaftar di database. Restart backend agar seed membuatnya.`); return; }
  console.log(`Terdaftar: ${email}`);
  console.log(`Role: ${user.role.name}${user.role.name === 'ADMIN' ? '' : ' (BUKAN admin, restart backend agar seed menaikkannya)'}`);
  console.log(`Aktif: ${user.isActive ? 'ya' : 'TIDAK'}`);
  console.log(`Terkunci: ${user.lockedUntil && user.lockedUntil > new Date() ? `ya, sampai ${user.lockedUntil.toISOString()}` : 'tidak'}`);
  if (password) {
    const ok = await verifyPassword(user.password, password);
    console.log(`Sandi di .env cocok dengan database: ${ok ? 'ya' : 'TIDAK (set ADMIN_PASSWORD_SYNC=true lalu restart backend)'}`);
  }
}
main().finally(() => prisma.$disconnect());
