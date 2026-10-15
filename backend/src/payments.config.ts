export type PaymentKind = 'qris' | 'bank' | 'ewallet';

/** Biaya admin per pembayaran (rupiah). */
export const adminFee = () => Number(process.env.ADMIN_FEE ?? 1500);

/** Detail tujuan pembayaran yang ditampilkan ke pembeli. Diisi dari .env, bukan dari kode. */
export function paymentDetails(name: string) {
  const env = process.env;
  if (name === 'QRIS') return { kind: 'qris' as PaymentKind, bankName: null, accountName: null, accountNumber: null };
  if (name === 'MANDIRI') {
    return { kind: 'bank' as PaymentKind, bankName: 'Bank Mandiri', accountName: env.PAY_MANDIRI_NAME || null, accountNumber: env.PAY_MANDIRI_NUMBER || null };
  }
  return { kind: 'ewallet' as PaymentKind, bankName: name, accountName: env[`PAY_${name}_NAME`] || null, accountNumber: env[`PAY_${name}_NUMBER`] || null };
}

/** Batas waktu bayar (menit) sebelum pesanan PENDING dibatalkan otomatis. */
export const pendingTtlMinutes = () => Number(process.env.PENDING_TTL_MINUTES ?? 10);
/** Maksimal transaksi berjalan (PENDING + PROCESSING) per user. */
export const maxActiveOrders = () => Number(process.env.MAX_ACTIVE_ORDERS ?? 3);
/** Menit tanpa aktivitas sebelum user otomatis keluar. */
export const idleMinutes = () => Number(process.env.IDLE_MINUTES ?? 40);
