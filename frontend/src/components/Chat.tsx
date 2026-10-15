import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../api';
import type { ChatMsg, Thread, Tx } from '../api';
import { shrinkImage } from '../image';
import { Skeleton, msg, usePoll } from '../ui';
import type { Notify } from '../ui';
import { Avatar } from './Avatar';
import { OrderDetailButton } from './OrderDetail';

const hm = (s: string) => new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
type Draft = { body: string; image: string; transactionId: string };

export function Bubble({ m, mine, extra }: { m: ChatMsg; mine: boolean; extra?: ReactNode }) {
  return (
    <div className={`bubble ${mine ? 'me' : 'other'}`}>
      {m.invoiceNo && <span className="chip">Pesanan {m.invoiceNo}</span>}
      {extra}
      {m.imageUrl && <a href={m.imageUrl} target="_blank" rel="noreferrer noopener"><img className="chatimg" src={m.imageUrl} alt="Foto terlampir" loading="lazy" /></a>}
      {m.body && <p>{m.body}</p>}
      <time>{hm(m.createdAt)}</time>
    </div>
  );
}

function Composer({ orders, busy, onSend }: { orders?: Tx[]; busy: boolean; onSend: (d: Draft) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [img, setImg] = useState('');
  const [ord, setOrd] = useState('');
  const [err, setErr] = useState('');
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setImg(await shrinkImage(f, { maxSide: 900, maxChars: 230_000 })); setErr(''); } catch (x) { setErr(msg(x)); }
  }
  const ready = (text.trim().length > 0 || !!img) && !busy;
  async function go() {
    if (!ready) return;
    if (await onSend({ body: text.trim(), image: img, transactionId: ord })) { setText(''); setImg(''); }
  }
  return (
    <div className="composer">
      {orders && orders.length > 0 && (
        <select value={ord} onChange={(e) => setOrd(e.target.value)} aria-label="Pesanan terkait">
          <option value="">Terkait pesanan (opsional)</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.invoiceNo} · {o.topupStock.game.name} {o.topupStock.quantity}</option>)}
        </select>
      )}
      {img && <div className="row"><img className="thumb" src={img} alt="Pratinjau foto" /><button type="button" className="btn ghost sm" onClick={() => setImg('')}>Hapus</button></div>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="composerRow">
        <label className="btn ghost sm attach">Foto<input type="file" accept="image/*" hidden onChange={pick} /></label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan…" rows={2} maxLength={1000} aria-label="Pesan"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void go(); } }} />
        <button className="btn sm" disabled={!ready} onClick={go}>Kirim</button>
      </div>
    </div>
  );
}

const scrollEnd = (el: HTMLElement | null) => el?.scrollIntoView?.({ block: 'end' });
const merge = (cur: ChatMsg[] | null, add: ChatMsg[]) => [...(cur ?? []), ...add.filter((x) => !(cur ?? []).some((c) => c.id === x.id))];

/** Panel chat pembeli dengan admin. */
export function ChatPanel({ onClose, onUnread, notify }: { onClose: () => void; onUnread: (n: number) => void; notify: Notify }) {
  const [msgs, setMsgs] = useState<ChatMsg[] | null>(null);
  const [orders, setOrders] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const read = () => api.chatRead().then(() => onUnread(0)).catch(() => undefined);

  useEffect(() => {
    api.getChat().then((l) => { setMsgs(l); read(); }).catch((e) => { setMsgs([]); notify(msg(e)); });
    api.getMine(1).then((r) => setOrders(r.items.slice(0, 10))).catch(() => undefined);
  }, []);
  usePoll(async () => {
    if (!msgs) return;
    try {
      const n = await api.getChat(msgs.length ? msgs[msgs.length - 1].id : undefined);
      if (n.length) { setMsgs((c) => merge(c, n)); if (n.some((x) => x.fromAdmin)) read(); }
    } catch { /* abaikan, coba lagi di siklus berikutnya */ }
  }, 5000, true);
  useEffect(() => { scrollEnd(end.current); }, [msgs?.length]);

  async function send(d: Draft) {
    setBusy(true);
    try {
      const m = await api.sendChat({ body: d.body || undefined, image: d.image || undefined, transactionId: d.transactionId || undefined });
      setMsgs((c) => merge(c, [m]));
      return true;
    } catch (e) { notify(msg(e)); return false; } finally { setBusy(false); }
  }
  return createPortal(
    <aside className="chatpanel" role="dialog" aria-label="Hubungi admin">
      <header>
        <div><strong>Hubungi admin</strong><small className="muted">Ceritakan kendala pembelian, bug, atau pertanyaanmu.</small></div>
        <button className="close" onClick={onClose} aria-label="Tutup chat">Tutup ✕</button>
      </header>
      <div className="chatbody">
        {msgs === null ? <Skeleton n={2} h={48} />
          : msgs.length === 0 ? <p className="muted small chatempty">Belum ada pesan. Tulis kendalamu di bawah, sebutkan pesanan terkait bila ada. Admin akan membalas di sini.</p>
          : msgs.map((m) => <Bubble key={m.id} m={m} mine={!m.fromAdmin} />)}
        <div ref={end} />
      </div>
      <Composer orders={orders} busy={busy} onSend={send} />
    </aside>,
    document.body,
  );
}

/** Menu Pesan di panel admin: daftar percakapan dan balasan. */
export function AdminChat({ notify, onUnread }: { notify: Notify; onUnread: (n: number) => void }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [sel, setSel] = useState<Thread | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[] | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const loadThreads = async () => {
    try { const r = await api.adminThreads(); setThreads(r.items); onUnread(r.items.reduce((a, t) => a + t.unread, 0)); }
    catch (e) { setThreads((c) => c ?? []); notify(msg(e)); }
  };
  useEffect(() => { loadThreads(); }, []);
  usePoll(loadThreads, 10000, true);
  useEffect(() => { scrollEnd(end.current); }, [msgs?.length]);

  async function open(t: Thread) {
    setSel(t); setMsgs(null);
    try { setMsgs(await api.adminChat(t.userId)); await api.adminChatRead(t.userId); loadThreads(); } catch (e) { notify(msg(e)); }
  }
  usePoll(async () => {
    if (!sel || !msgs) return;
    try {
      const n = await api.adminChat(sel.userId, msgs.length ? msgs[msgs.length - 1].id : undefined);
      if (n.length) { setMsgs((c) => merge(c, n)); if (n.some((x) => !x.fromAdmin)) { api.adminChatRead(sel.userId); loadThreads(); } }
    } catch { /* abaikan */ }
  }, 5000, !!sel);

  async function send(d: Draft) {
    if (!sel) return false;
    setBusy(true);
    try { const m = await api.adminSend(sel.userId, { body: d.body || undefined, image: d.image || undefined }); setMsgs((c) => merge(c, [m])); loadThreads(); return true; }
    catch (e) { notify(msg(e)); return false; } finally { setBusy(false); }
  }
  return (
    <div className={`adminchat ${sel ? 'open' : ''}`}>
      <div className="threads">
        {threads === null ? <Skeleton n={3} h={60} /> : threads.length === 0 ? <div className="empty">Belum ada pesan dari pembeli.</div> : threads.map((t) => (
          <button key={t.userId} className={`thread ${sel?.userId === t.userId ? 'on' : ''}`} onClick={() => open(t)}>
            <Avatar url={t.avatarUrl} name={t.fullName} size={38} />
            <span className="tmain"><strong>{t.fullName}</strong><small className="muted">{t.lastPreview}</small></span>
            {t.unread > 0 && <span className="badgeN">{t.unread}</span>}
          </button>
        ))}
      </div>
      <div className="convo">
        {!sel ? <div className="empty">Pilih percakapan untuk membalas.</div> : (
          <>
            <div className="convoHead">
              <button className="btn ghost sm backbtn" onClick={() => setSel(null)}>← Daftar</button>
              <Avatar url={sel.avatarUrl} name={sel.fullName} size={36} />
              <div><strong>{sel.fullName}</strong><small className="muted block">{sel.email}</small></div>
            </div>
            <div className="chatbody">
              {msgs === null ? <Skeleton n={2} h={48} /> : msgs.map((m) => (
                <Bubble key={m.id} m={m} mine={m.fromAdmin} extra={m.transactionId ? <OrderDetailButton id={m.transactionId} admin notify={notify} label="Lihat detail pesanan" /> : undefined} />
              ))}
              <div ref={end} />
            </div>
            <Composer busy={busy} onSend={send} />
          </>
        )}
      </div>
    </div>
  );
}
