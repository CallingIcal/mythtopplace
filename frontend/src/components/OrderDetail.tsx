import { useState } from 'react';
import * as api from '../api';
import type { Tx } from '../api';
import { Badge, Skeleton, money, msg } from '../ui';
import type { Notify } from '../ui';
import { Avatar } from './Avatar';
import { Modal } from './Modal';

const when = (s?: string | null) => (s ? new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

function ProofBlock({ t, admin, notify }: { t: Tx; admin: boolean; notify: Notify }) {
  const [img, setImg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!t.hasProof) {
    return admin ? <span className="nossr">TIDAK TERDAPAT SS</span>
      : <span className="muted small">{t.paymentRef ? 'Tidak ada screenshot, hanya nomor pembayaran.' : 'Belum ada bukti pembayaran.'}</span>;
  }
  const load = async () => {
    setBusy(true);
    try { setImg((admin ? await api.adminProof(t.id) : await api.myProof(t.id)).image); } catch (e) { notify(msg(e)); } finally { setBusy(false); }
  };
  return img
    ? <><img className="proofimg" src={img} alt="Foto bukti pembayaran" /><button className="btn ghost sm" onClick={() => setImg('')}>Sembunyikan foto</button></>
    : <button className="btn ghost sm" disabled={busy} onClick={load}>{busy ? 'Memuat…' : 'Lihat foto bukti pembayaran'}</button>;
}

function Body({ t, admin, notify }: { t: Tx; admin: boolean; notify: Notify }) {
  const item = t.amount - t.adminFee;
  const steps: [string, string | null | undefined][] = [
    ['Pesanan dibuat', t.createdAt],
    ['Pembayaran dikonfirmasi pembeli', t.paidAt],
    ['Diverifikasi admin', t.verifiedAt],
    [t.status === 'FAILED' ? 'Ditolak admin' : 'Dibatalkan', t.closedAt],
  ];
  return (
    <div className="detail">
      <div className="row between"><strong>{t.invoiceNo}</strong><Badge s={t.status} /></div>
      <h4>Linimasa</h4>
      <ol className="timeline">{steps.filter(([, at]) => at).map(([l, at]) => <li key={l}><span>{l}</span><span className="muted small">{when(at)}</span></li>)}</ol>
      <h4>Pesanan</h4>
      <dl className="kv">
        <dt>Game</dt><dd>{t.topupStock.game.name}</dd>
        <dt>Nominal</dt><dd>{t.topupStock.quantity}</dd>
        <dt>ID game</dt><dd>{t.gameUserId}</dd>
        <dt>Metode bayar</dt><dd>{t.payment.name}</dd>
        <dt>No. pembayaran</dt><dd>{t.paymentRef || '-'}</dd>
      </dl>
      <h4>Rincian harga</h4>
      <dl className="kv">
        {t.listPrice != null && <><dt>Harga normal</dt><dd>{money(t.listPrice)}</dd></>}
        {(t.discountPercent ?? 0) > 0 && t.listPrice != null && <><dt>Diskon {t.discountPercent}%</dt><dd className="ok">-{money(t.listPrice - item)}</dd></>}
        <dt>Harga item</dt><dd>{money(item)}</dd>
        <dt>Biaya admin</dt><dd>{money(t.adminFee)}</dd>
        <dt><strong>Total</strong></dt><dd><strong>{money(t.amount)}</strong></dd>
      </dl>
      <h4>Bukti pembayaran</h4>
      <ProofBlock t={t} admin={admin} notify={notify} />
      {admin && t.buyer && (
        <>
          <h4>Pembeli</h4>
          <div className="row"><Avatar url={t.buyer.avatarUrl} name={t.buyer.fullName} size={44} /><div><strong>{t.buyer.fullName}</strong><div className="muted small">{t.buyer.email}</div></div></div>
          <dl className="kv">
            <dt>Telepon</dt><dd>{t.buyer.phone || '-'}</dd>
            <dt>Instagram</dt><dd>{t.buyer.instagram ? `@${t.buyer.instagram}` : '-'}</dd>
            <dt>Alamat</dt><dd>{t.buyer.address || '-'}</dd>
            {t.verifierEmail && <><dt>Diverifikasi oleh</dt><dd>{t.verifierEmail}</dd></>}
          </dl>
        </>
      )}
    </div>
  );
}

/** Tombol "Detail" + dialog detail lengkap. Tetap bisa dibuka setelah transaksi selesai, dibatalkan, atau ditolak. */
export function OrderDetailButton({ id, admin = false, notify, label = 'Detail' }: { id: string; admin?: boolean; notify: Notify; label?: string }) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<Tx | null>(null);
  async function show() {
    setOpen(true); setT(null);
    try { setT(admin ? await api.adminTx(id) : await api.getTx(id)); } catch (e) { notify(msg(e)); setOpen(false); }
  }
  return (
    <>
      <button className="btn ghost sm" onClick={show}>{label}</button>
      {open && (
        <Modal label="Detail transaksi" onClose={() => setOpen(false)}>
          {t ? <Body t={t} admin={admin} notify={notify} /> : <Skeleton n={2} h={70} />}
          <button className="btn" onClick={() => setOpen(false)}>Tutup</button>
        </Modal>
      )}
    </>
  );
}
