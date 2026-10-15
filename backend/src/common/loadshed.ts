import type { NextFunction, Request, Response } from 'express';

/**
 * Pelindung beban: maksimal `max` permintaan diproses bersamaan, kelebihannya antre (maks `maxQueue`),
 * dan jika antrean penuh dijawab 503 dengan cepat. Mencegah server menggantung atau kehabisan memori saat lonjakan.
 */
export function loadShed(max = 400, maxQueue = 20000, maxWaitMs = 25000) {
  let running = 0;
  const queue: { go: () => void; at: number; res: Response }[] = [];
  const busy = (res: Response) => { res.setHeader('Retry-After', '2'); res.status(503).json({ statusCode: 503, message: 'Server sedang sibuk. Coba lagi beberapa detik lagi.' }); };
  const release = (): void => {
    const next = queue.shift();
    if (!next) { running--; return; }
    if (Date.now() - next.at > maxWaitMs) { busy(next.res); return release(); } // menunggu lebih dari 25 detik (batas baca nginx 30 detik): jawab 503 daripada diam
    next.go();
  };
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/health') return next();
    const start = () => {
      if (!res.socket || res.socket.destroyed) return release(); // klien sudah memutus koneksi saat menunggu giliran
      let done = false;
      const fin = () => { if (!done) { done = true; release(); } };
      res.on('finish', fin);
      res.on('close', fin);
      next();
    };
    if (running < max) { running++; start(); }
    else if (queue.length < maxQueue) queue.push({ go: start, at: Date.now(), res });
    else busy(res);
  };
}
