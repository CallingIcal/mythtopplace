export const SESSION_COOKIE = 'mtp_session';
export const SESSION_HOURS = Number(process.env.SESSION_HOURS || 8);

export const readCookie = (header: string | undefined, name: string) => {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header || '');
  return m ? decodeURIComponent(m[1]) : undefined;
};

/** Cookie sesi: tidak bisa dibaca JavaScript (HttpOnly), tidak ikut lintas situs (SameSite=Strict). */
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.COOKIE_SECURE !== 'false',
  path: '/api',
  maxAge: SESSION_HOURS * 3_600_000,
});

/** Daftar status yang dihitung sebagai transaksi berjalan. */
export const ACTIVE_STATUSES = ['PENDING', 'PROCESSING'] as const;
