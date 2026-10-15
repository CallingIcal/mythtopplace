import * as argon2 from 'argon2';
import { Gate } from './gate';

// Argon2id (pemenang Password Hashing Competition). Salt acak 16 byte dibuat otomatis untuk setiap hash,
// jadi dua user dengan password sama tetap menghasilkan nilai tersimpan yang berbeda.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Argon2 sengaja berat: batasi yang jalan bersamaan dan tolak cepat (503) jika antrean membludak, agar banjir login tidak melumpuhkan server.
const gate = new Gate(Number(process.env.HASH_CONCURRENCY || 4), Number(process.env.HASH_QUEUE || 400));
export const hashPassword = (plain: string) => gate.run(() => argon2.hash(plain, OPTIONS));
export const verifyPassword = (hash: string, plain: string) => gate.run(() => argon2.verify(hash, plain)).catch((e) => { if (e?.status === 503) throw e; return false; });
