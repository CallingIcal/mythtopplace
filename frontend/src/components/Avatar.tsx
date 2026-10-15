export function Avatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  const ini = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return url
    ? <img className="avatar" src={url} alt="" width={size} height={size} />
    : <span className="avatar ph" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">{ini}</span>;
}
