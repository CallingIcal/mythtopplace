/** Minimal ada satu @ dan satu titik setelahnya, tanpa spasi. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Syarat sandi untuk pendaftaran user biasa (admin dibuat lewat server dan tidak terikat aturan ini). */
export const passwordRules = (pw: string): [string, boolean][] => [
  ['Minimal 8 karakter', pw.length >= 8],
  ['Ada huruf kecil (a-z)', /[a-z]/.test(pw)],
  ['Ada huruf besar (A-Z)', /[A-Z]/.test(pw)],
  ['Ada angka (0-9)', /\d/.test(pw)],
];

export const passwordError = (pw: string) => {
  const bad = passwordRules(pw).find(([, ok]) => !ok);
  return bad ? `Syarat password belum terpenuhi: ${bad[0]}` : null;
};

export const GAME_ID_RE = /^[\w\-().#:@ ]{3,100}$/;
/** Roblox: "Nama (@username)". Username 3-20 karakter huruf, angka, atau garis bawah. */
export const ROBLOX_ID_RE = /^[\w .-]{2,30} \(@[A-Za-z0-9_]{3,20}\)$/;
export const buildRobloxId = (name: string, username: string) => `${name.trim()} (@${username.trim().replace(/^@/, '')})`;

export const PHONE_RE = /^(\+62|62|0)8\d{8,12}$/;
export const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
