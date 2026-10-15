import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Status, Tx } from './types';

export type Notify = (m: string) => void;
export const money = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`;
export const msg = (e: unknown) => (e instanceof Error ? e.message : 'Terjadi kesalahan');
export const LABEL: Record<Status, string> = {
  PENDING: 'Menunggu pembayaran', PROCESSING: 'Dalam proses', COMPLETED: 'Selesai', FAILED: 'Gagal', CANCELLED: 'Dibatalkan',
};
const TONE: Record<Status, string> = { PENDING: 'warn', PROCESSING: 'info', COMPLETED: 'ok', FAILED: 'bad', CANCELLED: 'mute' };

export function usePoll(fn: () => void, ms: number, on: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') ref.current(); }, ms);
    return () => clearInterval(id);
  }, [on, ms]);
}

export const Badge = ({ s }: { s: Status }) => <span className={`badge ${TONE[s]}`}>{LABEL[s]}</span>;
export const BackHome = () => <a className="back" href="#/">← Kembali ke awal</a>;
export const Skeleton = ({ n = 4, h = 84 }: { n?: number; h?: number }) => (
  <>{Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ height: h }} />)}</>
);

export function Order({ t, admin, children, actions, footer }: { t: Tx; admin?: boolean; children?: ReactNode; actions?: ReactNode; footer?: ReactNode }) {
  return (
    <article className="order">
      <div className="orderMain">
        <span className="muted small">{t.invoiceNo} · {new Date(t.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <strong>{t.topupStock.game.name}, {t.topupStock.quantity}</strong>
        <span className="muted small">
          {admin && t.user ? `${t.user.fullName} (${t.user.email}) · ` : ''}ID game {t.gameUserId} · {t.payment.name}
        </span>
        <span className="small">Total <strong>{money(t.amount)}</strong> <span className="muted">(termasuk biaya admin {money(t.adminFee)})</span></span>
        {(t.paymentRef || t.hasProof) && (
          <span className="muted small">Bukti: {t.paymentRef ? `No. ${t.paymentRef}` : ''}{t.paymentRef && t.hasProof ? ' + ' : ''}{t.hasProof ? 'screenshot' : ''}</span>
        )}
        {admin && !t.hasProof && <span className="nossr">TIDAK TERDAPAT SS</span>}
      </div>
      <div className="actions">{actions}{children}<Badge s={t.status} /></div>
      {footer && <div className="orderFoot">{footer}</div>}
    </article>
  );
}
