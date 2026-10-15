import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { shrinkImage } from '../image';
import { msg } from '../ui';

export function ProofForm({ onSubmit }: { onSubmit: (b: { paymentRef: string; proofImage: string }) => void }) {
  const [ref, setRef] = useState('');
  const [img, setImg] = useState('');
  const [error, setError] = useState('');

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setImg(await shrinkImage(f)); setError(''); } catch (x) { setError(msg(x)); }
  }
  const ready = ref.trim().length >= 3 || !!img;
  return (
    <div className="proof">
      <strong>Bukti pembayaran (wajib)</strong>
      <p className="muted small">Kirim screenshot bukti bayar, atau isi nomor pembayaran. Boleh keduanya.</p>
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Nomor pembayaran / referensi" maxLength={100} />
      <label className="btn ghost sm">Pilih screenshot<input type="file" accept="image/*" hidden onChange={pick} /></label>
      {img && <div className="row"><img className="thumb" src={img} alt="Pratinjau bukti pembayaran" /><button type="button" className="btn ghost sm" onClick={() => setImg('')}>Hapus</button></div>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={!ready} onClick={() => onSubmit({ paymentRef: ref.trim(), proofImage: img })}>Saya sudah bayar</button>
    </div>
  );
}
