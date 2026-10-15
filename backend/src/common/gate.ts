import { ServiceUnavailableException } from '@nestjs/common';

/** Pembatas konkurensi: maksimal `max` pekerjaan jalan bersamaan, sisanya antre (maks `maxQueue`), selebihnya ditolak 503. */
export class Gate {
  private running = 0;
  private queue: (() => void)[] = [];
  constructor(private max: number, private maxQueue: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.max) this.running++;
    else {
      if (this.queue.length >= this.maxQueue) throw new ServiceUnavailableException('Server sedang sibuk. Coba lagi beberapa detik lagi.');
      await new Promise<void>((resolve) => this.queue.push(resolve)); // slot diserahkan langsung oleh pekerjaan sebelumnya
    }
    try { return await fn(); }
    finally { const next = this.queue.shift(); if (next) next(); else this.running--; }
  }
}
