import { useEffect, useState } from 'react';
import * as api from '../api';
import type { AuditLog, Game, Status, Stock, Tx } from '../api';
import { AdminChat } from '../components/Chat';
import { ConfirmButton, Modal } from '../components/Modal';
import { OrderDetailButton } from '../components/OrderDetail';
import { BackHome, LABEL, Order, Skeleton, msg, usePoll } from '../ui';
import type { Notify } from '../ui';

type Tab = 'orders' | 'catalog' | 'chat' | 'audit';
type Run = (fn: () => Promise<unknown>, ok: string) => Promise<boolean>;

export default function Admin({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState<Tab>('orders');
  const [unread, setUnread] = useState(0);
  const poll = () => api.adminChatSummary().then((r) => setUnread(r.unread)).catch(() => undefined);
  useEffect(() => { poll(); }, []);
  usePoll(poll, 15000, tab !== 'chat');
  const tabs: [Tab, string][] = [['orders', 'Pesanan'], ['chat', 'Pesan'], ['catalog', 'Katalog dan diskon'], ['audit', 'Audit log']];
  return (
    <>
      <BackHome />
      <h1 className="h1">Ruang admin</h1>
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'chat' && unread > 0 && <span className="badgeN">{unread}</span>}</button>)}</div>
      {tab === 'orders' && <Orders notify={notify} />}
      {tab === 'chat' && <AdminChat notify={notify} onUnread={setUnread} />}
      {tab === 'catalog' && <Catalog notify={notify} />}
      {tab === 'audit' && <Audit notify={notify} />}
    </>
  );
}

function ProofButton({ id, notify }: { id: string; notify: Notify }) {
  const [img, setImg] = useState('');
  const open = async () => { try { setImg((await api.adminProof(id)).image); } catch (e) { notify(msg(e)); } };
  return (
    <>
      <button className="btn ghost sm" onClick={open}>Lihat bukti (SS)</button>
      {img && (
        <Modal label="Bukti pembayaran" onClose={() => setImg('')}>
          <img src={img} alt="Bukti pembayaran" />
          <button className="btn" onClick={() => setImg('')}>Tutup</button>
        </Modal>
      )}
    </>
  );
}

function Orders({ notify }: { notify: Notify }) {
  const [filter, setFilter] = useState('PROCESSING');
  const [items, setItems] = useState<Tx[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function load(p = 1) {
    try {
      const r = await api.adminTransactions(filter, p);
      setItems((cur) => (p === 1 || !cur ? r.items : [...cur, ...r.items]));
      setPage(p); setTotal(r.total);
    } catch (e) { setItems((cur) => cur ?? []); notify(msg(e)); }
  }
  useEffect(() => { load(1); }, [filter]);
  usePoll(() => { if (page === 1) load(1); }, 15000, true);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notify(ok); await load(1); } catch (e) { notify(msg(e)); }
  }
  return (
    <>
      <div className="row">
        <select className="inline" value={filter} onChange={(e) => { setItems(null); setFilter(e.target.value); }}>
          <option value="">Semua status</option>
          {(Object.keys(LABEL) as Status[]).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
        <span className="muted small">{total} pesanan</span>
      </div>
      <div className="list">
        {items === null ? <Skeleton n={3} /> : items.map((t) => (
          <Order key={t.id} t={t} admin actions={<OrderDetailButton id={t.id} admin notify={notify} />}>
            {t.hasProof && <ProofButton id={t.id} notify={notify} />}
            {t.status === 'PROCESSING' && <button className="btn sm" onClick={() => act(() => api.verifyTransaction(t.id), 'Pesanan diselesaikan.')}>Pesanan selesai</button>}
            {(t.status === 'PROCESSING' || t.status === 'PENDING') && (
              <ConfirmButton label="Tolak" title="Tolak pesanan ini?" message="Status menjadi Gagal dan stok dikembalikan. Tindakan ini tercatat di audit log." confirmLabel="Ya, tolak"
                onConfirm={() => act(() => api.rejectTransaction(t.id), 'Pesanan ditolak.')} />
            )}
          </Order>
        ))}
        {items?.length === 0 && <div className="empty">Tidak ada pesanan untuk filter ini.</div>}
      </div>
      {items && items.length < total && <button className="btn ghost" onClick={() => load(page + 1)}>Muat lebih banyak</button>}
    </>
  );
}

type StockPatch = { quantity: string; stock: number; price: number; discountPercent: number; isActive: boolean };

function StockRow({ s, onSave }: { s: Stock; onSave: (d: StockPatch) => void }) {
  const [name, setName] = useState(s.quantity);
  const [stock, setStock] = useState(String(s.stock));
  const [price, setPrice] = useState(String(s.price));
  const [disc, setDisc] = useState(String(s.discountPercent));
  const [active, setActive] = useState(s.isActive);
  return (
    <div className="row">
      <input className="inline grow" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nama nominal / gamepass" maxLength={50} />
      <input className="inline num" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stok" />
      <input className="inline num" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Harga" />
      <input className="inline num" type="number" min={0} max={90} value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Diskon persen" />
      <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Aktif</label>
      <button className="btn sm" onClick={() => onSave({ quantity: name.trim(), stock: Number(stock), price: Number(price), discountPercent: Number(disc), isActive: active })}>Simpan</button>
    </div>
  );
}

function NewStock({ onAdd }: { onAdd: (d: { quantity: string; stock: number; price: number; discountPercent: number }) => Promise<boolean> }) {
  const [q, setQ] = useState('');
  const [stock, setStock] = useState('20');
  const [price, setPrice] = useState('');
  const [disc, setDisc] = useState('0');
  const add = () => { if (q.trim() && price) onAdd({ quantity: q.trim(), stock: Number(stock), price: Number(price), discountPercent: Number(disc) }).then((ok) => { if (ok) { setQ(''); setPrice(''); } }); };
  return (
    <div className="row">
      <input className="inline grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nominal / gamepass baru" maxLength={50} />
      <input className="inline num" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stok" />
      <input className="inline num" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Harga" />
      <input className="inline num" type="number" min={0} max={90} value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Diskon persen" />
      <button className="btn ghost sm" onClick={add}>Tambah</button>
    </div>
  );
}

function GamePanel({ g, run }: { g: Game; run: Run }) {
  const [name, setName] = useState(g.name);
  const [desc, setDesc] = useState(g.description ?? '');
  const [pct, setPct] = useState('10');
  return (
    <section className="panel">
      <div className="row">
        <input className="inline grow" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nama game" maxLength={100} />
        <input className="inline grow" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Deskripsi game" maxLength={500} placeholder="Deskripsi" />
        <button className="btn sm" onClick={() => run(() => api.updateGame(g.id, { name: name.trim(), description: desc }), 'Game disimpan.')}>Simpan nama</button>
        <button className="btn ghost sm" onClick={() => run(() => api.updateGame(g.id, { isActive: !g.isActive }), 'Status game diperbarui.')}>{g.isActive ? 'Nonaktifkan game' : 'Aktifkan game'}</button>
      </div>
      <div className="row">
        <span className="muted small">Diskon semua nominal game ini:</span>
        <input className="inline num" type="number" min={0} max={90} value={pct} onChange={(e) => setPct(e.target.value)} aria-label="Diskon massal persen" />
        <span className="muted small">%</span>
        <button className="btn ghost sm" onClick={() => run(() => api.discountGame(g.id, Number(pct)), 'Diskon diterapkan.')}>Terapkan</button>
        <button className="btn ghost sm" onClick={() => run(() => api.discountGame(g.id, 0), 'Diskon dihapus.')}>Hapus diskon</button>
      </div>
      <p className="cols muted small">Nama nominal / gamepass · Stok · Harga (Rp) · Diskon (%)</p>
      {g.stocks?.map((s) => (
        <StockRow key={`${s.id}-${s.quantity}-${s.stock}-${s.price}-${s.discountPercent}-${s.isActive}`} s={s}
          onSave={(d) => run(() => api.updateStock(s.id, d), 'Nominal disimpan.')} />
      ))}
      <NewStock onAdd={(d) => run(() => api.createStock({ gameId: g.id, ...d }), 'Nominal ditambahkan.')} />
    </section>
  );
}

function Catalog({ notify }: { notify: Notify }) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const load = () => api.adminCatalog().then(setGames).catch((e) => notify(msg(e)));
  useEffect(() => { load(); }, []);
  const run: Run = async (fn, ok) => {
    try { await fn(); notify(ok); await load(); return true; } catch (e) { notify(msg(e)); return false; }
  };
  const addGame = () => { if (name.trim() && slug) run(() => api.createGame({ name: name.trim(), slug }), 'Game ditambahkan.').then((ok) => { if (ok) { setName(''); setSlug(''); } }); };

  return (
    <>
      <p className="muted small">Pilihan yang dinonaktifkan tetap tampil ke pembeli dengan tulisan merah "Sedang tidak tersedia". Game dengan slug <code>roblox</code> meminta nama dan username Roblox.</p>
      <div className="row">
        <input className="inline grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama game baru" maxLength={100} />
        <input className="inline grow" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="slug-game" maxLength={120} />
        <button className="btn ghost sm" onClick={addGame}>Tambah game</button>
      </div>
      {games === null && <Skeleton n={2} h={140} />}
      {games?.map((g) => <GamePanel key={`${g.id}-${g.name}-${g.description}-${g.isActive}`} g={g} run={run} />)}
    </>
  );
}

function Audit({ notify }: { notify: Notify }) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  useEffect(() => { api.adminAudit().then(setLogs).catch((e) => { setLogs([]); notify(msg(e)); }); }, []);
  return (
    <div className="list">
      {logs === null ? <Skeleton n={3} h={64} /> : logs.map((l) => (
        <article className="order" key={l.id}>
          <div className="orderMain">
            <span className="muted small">{new Date(l.createdAt).toLocaleString('id-ID')} · {l.admin.email}</span>
            <strong>{l.action}</strong>
            <span className="muted small">{l.entityType} #{l.entityId}{l.statusBefore || l.statusAfter ? ` · ${l.statusBefore ?? ''} ke ${l.statusAfter ?? ''}` : ''}</span>
          </div>
        </article>
      ))}
      {logs?.length === 0 && <div className="empty">Belum ada tindakan admin.</div>}
    </div>
  );
}
