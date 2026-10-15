export const PHONE_RE = /^(\+62|62|0)8\d{8,12}$/;
export const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
/** Nama profil hanya boleh diganti seminggu sekali. */
export const NAME_COOLDOWN_MS = 7 * 24 * 3600 * 1000;
export const cleanPhone = (v: string) => v.replace(/[\s-]/g, '');
export const cleanIg = (v: string) => v.trim().replace(/^@/, '');
