export const GAME_ID_RE = /^[\w\-().#:@ ]{3,100}$/;
/** Roblox: "Nama (@username)". Username 3-20 karakter huruf, angka, atau garis bawah. */
export const ROBLOX_ID_RE = /^[\w .-]{2,30} \(@[A-Za-z0-9_]{3,20}\)$/;
export const validGameUserId = (slug: string, id: string) => (slug === 'roblox' ? ROBLOX_ID_RE : GAME_ID_RE).test(id);
