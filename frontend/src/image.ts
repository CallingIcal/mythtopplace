/** Kecilkan screenshot di browser sebelum dikirim (JPEG, sisi terpanjang 1100px, di bawah ~280 KB). */
export async function shrinkImage(file: File, opts: { maxSide?: number; maxChars?: number; square?: boolean } = {}): Promise<string> {
  const { maxSide = 1100, maxChars = 380_000, square = false } = opts;
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('Gambar tidak dapat dibaca'));
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const sw = square ? side : img.width, sh = square ? side : img.height;
    const sx = square ? (img.width - side) / 2 : 0, sy = square ? (img.height - side) / 2 : 0;
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    for (const q of [0.78, 0.6, 0.45, 0.3]) {
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= maxChars) return d;
    }
    throw new Error('Gambar terlalu besar, coba screenshot lain');
  } finally { URL.revokeObjectURL(url); }
}
