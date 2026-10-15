import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import * as api from '../api';
import type { Profile as P } from '../api';
import { Avatar } from '../components/Avatar';
import { shrinkImage } from '../image';
import { IG_RE, PHONE_RE } from '../policy';
import { BackHome, msg } from '../ui';
import type { Notify } from '../ui';
import History from './History';

function DataForm({ p, notify, onSaved }: { p: P; notify: Notify; onSaved: (p: P) => void }) {
  const [name, setName] = useState(p.fullName);
  const [phone, setPhone] = useState(p.phone ?? '');
  const [ig, setIg] = useState(p.instagram ?? '');
  const [addr, setAddr] = useState(p.address ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const locked = !!p.nameChangeAvailableAt;
  const until = p.nameChangeAvailableAt ? new Date(p.nameChangeAvailableAt).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '';

  function apply(r: P) { onSaved(r); setName(r.fullName); setPhone(r.phone ?? ''); setIg(r.instagram ?? ''); setAddr(r.address ?? ''); }
  async function save() {
    setErr('');
    const ph = phone.replace(/[\s-]/g, ''), igc = ig.trim().replace(/^@/, '');
    if (ph && !PHONE_RE.test(ph)) return setErr('Nomor telepon tidak valid (contoh 081234567890)');
    if (igc && !IG_RE.test(igc)) return setErr('Nama Instagram hanya huruf, angka, titik, dan garis bawah');
    const body: Partial<{ fullName: string; phone: string; instagram: string; address: string }> = { phone: ph, instagram: igc, address: addr };
    if (!locked && name.trim() !== p.fullName) {
      if (name.trim().length < 2) return setErr('Nama minimal 2 karakter');
      body.fullName = name.trim();
    }
    setBusy(true);
    try { apply(await api.updateProfile(body)); notify('Profil disimpan.'); } catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  }
  async function pickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { apply(await api.setAvatar(await shrinkImage(f, { maxSide: 320, maxChars: 150_000, square: true }))); notify('Foto profil diperbarui.'); } catch (x) { notify(msg(x)); }
  }
  async function dropAvatar() { try { apply(await api.removeAvatar()); notify('Foto profil dihapus.'); } catch (x) { notify(msg(x)); } }

  return (
    <div className="panel">
      <div className="row">
        <Avatar url={p.avatarUrl} name={p.fullName} size={72} />
        <label className="btn ghost sm">Ganti foto<input type="file" accept="image/*" hidden onChange={pickAvatar} /></label>
        {p.avatarUrl && <button className="btn ghost sm" onClick={dropAvatar}>Hapus foto</button>}
      </div>
      <label className="field">Nama profil
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} disabled={locked} />
        <small className="muted">{locked ? `Nama bisa diganti lagi pada ${until}.` : 'Nama hanya dapat diganti seminggu sekali. Pastikan sudah benar.'}</small>
      </label>
      <label className="field">Email<input value={p.email} disabled /></label>
      <label className="field">Nomor telepon<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" inputMode="tel" maxLength={30} /></label>
      <label className="field">Instagram<input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@username" maxLength={40} /></label>
      <label className="field">Alamat rumah
        <textarea value={addr} onChange={(e) => setAddr(e.target.value)} rows={3} maxLength={300} placeholder="Jalan, nomor, kelurahan, kota" />
        <small className="muted">{addr.length}/300</small>
      </label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
    </div>
  );
}

export default function Profile({ tab, notify, onProfile }: { tab: 'data' | 'riwayat'; notify: Notify; onProfile: (p: P) => void }) {
  const [p, setP] = useState<P | null>(null);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    api.getProfile().then((x) => { setP(x); onProfile(x); }).catch((e) => notify(msg(e)));
    api.getMine(1, 'active').then((r) => setActive(r.total)).catch(() => undefined);
  }, []);
  const saved = (x: P) => { setP(x); onProfile(x); };
  return (
    <>
      <BackHome />
      <div className="profileHead">
        <Avatar url={p?.avatarUrl} name={p?.fullName ?? ''} size={64} />
        <div><h1 className="h1">{p?.fullName ?? 'Profil'}</h1><p className="muted">{p?.email}</p></div>
      </div>
      {active !== null && active > 0 && tab === 'data' && <a className="hint" href="#/riwayat">Kamu punya {active} transaksi yang belum selesai. Lihat dan pantau di Riwayat pembelian.</a>}
      <div className="tabs">
        <a className={tab === 'data' ? 'on' : ''} href="#/profil">Data diri</a>
        <a className={tab === 'riwayat' ? 'on' : ''} href="#/riwayat">Riwayat pembelian</a>
      </div>
      {tab === 'data' ? (p ? <DataForm p={p} notify={notify} onSaved={saved} /> : <div className="skel" style={{ height: 240 }} />) : <History embedded notify={notify} />}
    </>
  );
}
