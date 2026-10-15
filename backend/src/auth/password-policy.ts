export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Minimal ada satu @ dan satu titik setelahnya, tanpa spasi. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Aturan sandi untuk pendaftaran user biasa. Akun admin dibuat lewat seed (.env) dan tidak melewati aturan ini. */
export function validateUserPassword(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password minimal 8 karakter';
  if (!/[a-z]/.test(pw)) return 'Password harus punya minimal 1 huruf kecil';
  if (!/[A-Z]/.test(pw)) return 'Password harus punya minimal 1 huruf besar';
  if (!/\d/.test(pw)) return 'Password harus punya minimal 1 angka';
  return null;
}
