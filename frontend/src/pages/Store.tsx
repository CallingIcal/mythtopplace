import { useEffect, useState } from 'react';
import * as api from '../api';
import type { Checkout, Game, Stock, User } from '../api';
import { CheckWarning, PaymentWarning } from '../components/PaymentGuide';
import { GAME_ID_RE, ROBLOX_ID_RE, buildRobloxId } from '../policy';
import { go } from '../router';
import { Skeleton, money, msg } from '../ui';
import type { Notify } from '../ui';

const Unavailable = () => <span className="unavail">Sedang tidak tersedia</span>;

export default function Store({ user, notify }: { user: User | null; notify: Notify }) {
  const [games, setGames] = useState<Game[] | null>(api.peek<Game[]>('games') ?? null);
  const [checkout, setCheckout] = useState<Checkout | null>(api.peek<Checkout>('payments') ?? null);
  const [game, setGame] = useState<Game | null>(null);
  const [stocks, setStocks] = useState<Stock[] | null>(null);
  const [stock, setStock] = useState<Stock | null>(null);
  const [gameUserId, setGameUserId] = useState('');
  const [rbName, setRbName] = useState('');
  const [rbUser, setRbUser] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.getGames(), api.getPayments()])
      .then(([g, c]) => { setGames(g); setCheckout(c); })
      .catch((e) => { setGames([]); notify(msg(e)); });
  }, []);

  const reset = () => { setGame(null); setStocks(null); setStock(null); setPaymentId(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  async function pick(g: Game) {
    setGame(g); setStock(null); setStocks(api.peek<Stock[]>(`stocks:${g.id}`) ?? null);
    try { setStocks(await api.getStocks(g.id)); } catch (e) { setStocks([]); notify(msg(e)); }
  }

  const roblox = game?.slug === 'roblox';
  const idValue = roblox ? buildRobloxId(rbName, rbUser) : gameUserId.trim();
  const idOk = roblox ? ROBLOX_ID_RE.test(idValue) : GAME_ID_RE.test(idValue);
  const fee = checkout?.adminFee ?? 0;
  const itemPrice = stock ? stock.finalPrice ?? stock.price : 0;
  const total = itemPrice + fee;
  const method = checkout?.methods.find((m) => String(m.id) === paymentId);

  async function order() {
    if (!user) { notify('Masuk atau buat akun dulu untuk membuat pesanan.'); return go('/masuk'); }
    if (!stock || !idOk || !paymentId) { notify(roblox ? 'Lengkapi nama dan username Roblox yang valid, nominal, dan metode pembayaran.' : 'Lengkapi nominal, ID game yang valid, dan metode pembayaran.'); return; }
    setBusy(true);
    try {
      await api.createTransaction({ topupStockId: Number(stock.id), gameUserId: idValue, paymentId: Number(paymentId) });
      notify('Pesanan dibuat. Lakukan pembayaran sesuai panduan, lalu kirim bukti di Riwayat.');
      go('/riwayat');
    } catch (e) { notify(msg(e)); setBusy(false); }
  }

  return (
    <>
      <section className="intro">
        <h1>Top up game, tanpa ribet.</h1>
        <p className="lead">Pilih game, pilih nominal, isi ID. Pesananmu diverifikasi admin dan statusnya bisa dipantau kapan saja.</p>
      </section>

      {game && <div className="row"><button className="btn ghost sm" onClick={reset}>← Kembali ke awal</button></div>}

      <h2 className="step"><span>1</span>Pilih game</h2>
      <div className="grid">
        {games === null ? <Skeleton n={4} h={76} /> : games.map((g) => (
          <button key={g.id} disabled={!g.isActive} className={`card ${game?.id === g.id ? 'on' : ''} ${g.isActive ? '' : 'off'}`} onClick={() => pick(g)}>
            <span className="tile">{g.name.slice(0, 2).toUpperCase()}</span>
            <span><strong>{g.name}</strong><span className="block small">{g.isActive ? <span className="muted">{g.description || 'Top up'}</span> : <Unavailable />}</span></span>
          </button>
        ))}
        {games?.length === 0 && <div className="empty">Belum ada game tersedia.</div>}
      </div>

      {game && (
        <>
          <h2 className="step"><span>2</span>Pilih nominal, {game.name}<button className="close" onClick={() => { setGame(null); setStock(null); }} aria-label="Tutup pilihan top up">Tutup ✕</button></h2>
          <div className="grid">
            {stocks === null ? <Skeleton n={4} h={96} /> : stocks.map((s) => (
              <button key={s.id} disabled={!s.available} className={`card col ${stock?.id === s.id ? 'on' : ''} ${s.available ? '' : 'off'}`} onClick={() => setStock(s)}>
                <strong>{s.quantity}</strong>
                {s.available ? (
                  <>
                    <span className="price">{s.discountPercent > 0 && <s className="muted small">{money(s.price)}</s>} {money(s.finalPrice ?? s.price)}</span>
                    {s.discountPercent > 0 && <span className="disc">Diskon {s.discountPercent}%</span>}
                    <span className="muted small">{s.stock} stok</span>
                  </>
                ) : <Unavailable />}
              </button>
            ))}
            {stocks?.length === 0 && <div className="empty">Belum ada nominal untuk game ini.</div>}
          </div>
        </>
      )}

      {stock && game && (
        <>
          <h2 className="step"><span>3</span>Detail pesanan<button className="close" onClick={() => setStock(null)} aria-label="Tutup detail pesanan">Tutup ✕</button></h2>
          <div className="panel">
            <div className="lines">
              <div><span>{stock.quantity}</span><span>{money(stock.price)}</span></div>
              {stock.discountPercent > 0 && <div className="ok"><span>Diskon {stock.discountPercent}%</span><span>-{money(stock.price - itemPrice)}</span></div>}
              <div><span>Biaya admin</span><span>{money(fee)}</span></div>
              <div className="sum"><span>Total pembayaran</span><span>{money(total)}</span></div>
            </div>
            {roblox ? (
              <>
                <label className="field">Nama Roblox (display name)
                  <input value={rbName} onChange={(e) => setRbName(e.target.value)} placeholder="Contoh: Budi Santoso" maxLength={30} autoComplete="off" />
                </label>
                <label className="field">Username Roblox
                  <input value={rbUser} onChange={(e) => setRbUser(e.target.value)} placeholder="Contoh: budi_rbx" maxLength={21} autoComplete="off" />
                </label>
                <p className="muted small">Untuk Robux kami memerlukan nama dan username, bukan ID angka.</p>
              </>
            ) : (
              <label className="field">ID game
                <input value={gameUserId} onChange={(e) => setGameUserId(e.target.value)} placeholder="Contoh: 12345678 (1234)" maxLength={100} autoComplete="off" />
              </label>
            )}
            <label className="field">Metode pembayaran
              <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
                <option value="">Pilih pembayaran</option>
                {checkout?.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            {method && <p className="muted small">Setelah pesanan dibuat, QRIS / rekening / nomor {method.name} dan panduan bayar tampil di menu pembayaran bersama kolom bukti. Nominal yang harus dibayar: <strong>{money(total)}</strong>.</p>}
            <CheckWarning />
            <PaymentWarning />
            <button className="btn" disabled={busy} onClick={order}>{busy ? 'Memproses…' : 'Buat pesanan'}</button>
            <button className="btn ghost" onClick={reset}>← Kembali ke awal</button>
          </div>
        </>
      )}
    </>
  );
}
