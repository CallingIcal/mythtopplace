import { useEffect, useState } from 'react';
import * as api from '../api';
import type { Payment, Tx } from '../api';
import { CheckWarning, PaymentGuide, PaymentWarning } from '../components/PaymentGuide';
import { ProofForm } from '../components/ProofForm';
import { OrderDetailButton } from '../components/OrderDetail';
import { BackHome, Order, Skeleton, money, msg, usePoll } from '../ui';
import type { Notify } from '../ui';

function Countdown({ until, onDone }: { until: string; onDone: () => void }) {
  const left0 = () => Math.max(0, new Date(until).getTime() - Date.now());
  const [left, setLeft] = useState(left0);
  useEffect(() => {
    const id = setInterval(() => { const l = left0(); setLeft(l); if (l === 0) { clearInterval(id); onDone(); } }, 1000);
    return () => clearInterval(id);
  }, [until]);
  const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
  return <p className={`countdown ${left < 120000 ? 'hot' : ''}`}>Sisa waktu pembayaran: <strong>{m}:{String(s).padStart(2, '0')}</strong>. Jika tidak dibayar sampai waktu habis, pesanan dibatalkan otomatis.</p>;
}

const CHIPS: [string, string][] = [['', 'Semua'], ['active', 'Berjalan'], ['done', 'Selesai'], ['closed', 'Gagal / batal']];

export default function History({ notify, embedded = false }: { notify: Notify; embedded?: boolean }) {
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState<Tx[] | null>(null);
  const [methods, setMethods] = useState<Payment[]>(api.peek<{ methods: Payment[] }>('payments')?.methods ?? []);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function load(p = 1) {
    try {
      const r = await api.getMine(p, filter);
      setItems((cur) => (p === 1 || !cur ? r.items : [...cur, ...r.items]));
      setPage(p); setTotal(r.total);
    } catch (e) { setItems((cur) => cur ?? []); notify(msg(e)); }
  }
  useEffect(() => { api.getPayments().then((c) => setMethods(c.methods)).catch(() => undefined); }, []);
  useEffect(() => { setItems(null); load(1); }, [filter]);
  usePoll(() => { if (page === 1) load(1); }, 10000, !!items?.some((t) => t.status === 'PENDING' || t.status === 'PROCESSING'));

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notify(ok); await load(1); } catch (e) { notify(msg(e)); }
  }
  return (
    <>
      {!embedded && <BackHome />}
      {!embedded && <h1 className="h1">Riwayat pesanan</h1>}
      <p className="muted">Diperbarui otomatis selama ada pesanan yang belum selesai. Tekan Detail untuk melihat rincian lengkap, termasuk transaksi yang sudah selesai.</p>
      <div className="chips">{CHIPS.map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="list">
        {items === null ? <Skeleton n={3} /> : items.map((t) => {
          const method = methods.find((m) => m.id === t.payment.id);
          return (
            <Order key={t.id} t={t} actions={<OrderDetailButton id={t.id} notify={notify} />} footer={t.status === 'PENDING' && (
              <>
                <div className="payTotal"><span>Bayar tepat sebesar</span><strong>{money(t.amount)}</strong><small>Harga {money(t.amount - t.adminFee)} + biaya admin {money(t.adminFee)}</small></div>
                {t.expiresAt && <Countdown until={t.expiresAt} onDone={() => setTimeout(() => load(1), 2000)} />}
                {method && <PaymentGuide method={method} total={t.amount} />}
                <PaymentWarning />
                <CheckWarning />
                <ProofForm onSubmit={(b) => act(() => api.confirmPayment(t.id, b), 'Terima kasih. Admin akan memverifikasi pembayaranmu.')} />
                <button className="btn ghost sm" onClick={() => act(() => api.cancelTransaction(t.id), 'Pesanan dibatalkan.')}>Batalkan pesanan</button>
              </>
            )} />
          );
        })}
        {items?.length === 0 && <div className="empty">{filter ? 'Tidak ada transaksi pada kategori ini.' : 'Belum ada pesanan. Pilih game di beranda untuk mulai.'}</div>}
      </div>
      {items && items.length < total && <button className="btn ghost" onClick={() => load(page + 1)}>Muat lebih banyak</button>}
    </>
  );
}
