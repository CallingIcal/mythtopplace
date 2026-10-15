import { Suspense, lazy, useEffect, useState } from 'react';
import * as api from './api';
import type { Profile as Prof, User } from './api';
import { Avatar } from './components/Avatar';
import { ChatPanel } from './components/Chat';
import { go, useRoute } from './router';
import type { Route } from './router';
import { Skeleton } from './ui';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Store from './pages/Store';

const IDLE_MS = 40 * 60 * 1000;
const loadAdmin = () => import('./pages/Admin');
const Admin = lazy(loadAdmin);

export default function App() {
  const route = useRoute();
  const [user, setUser] = useState<User | null>(api.session.user);
  const [notice, setNotice] = useState('');
  const [storeKey, setStoreKey] = useState(0);
  const [profile, setProfile] = useState<Prof | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Validasi sesi ke server (cookie HttpOnly) tanpa menghambat render awal.
  useEffect(() => {
    if (api.session.user) api.me().then((u) => { api.session.save(u); setUser(u); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const expired = () => { setUser(null); setNotice('Sesi berakhir. Silakan masuk lagi.'); go('/masuk'); };
    window.addEventListener('auth-expired', expired);
    return () => window.removeEventListener('auth-expired', expired);
  }, []);
  useEffect(() => { if (user?.role === 'ADMIN') loadAdmin(); }, [user]);
  // Data profil (foto di navigasi) dan jumlah pesan admin yang belum dibaca (polling GET tidak memperpanjang sesi).
  useEffect(() => {
    if (!user) { setProfile(null); setUnread(0); setChatOpen(false); return; }
    let on = true;
    api.getProfile().then((p) => on && setProfile(p)).catch(() => undefined);
    if (user.role === 'ADMIN') return () => { on = false; };
    const tick = () => { if (document.visibilityState === 'visible') api.chatSummary().then((r) => on && setUnread(r.unread)).catch(() => undefined); };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { on = false; clearInterval(id); };
  }, [user?.id]);
  // AFK 40 menit: keluar otomatis. Aktivitas nyata dikirim ke server sebagai heartbeat (polling tidak dihitung).
  useEffect(() => {
    if (!user) return;
    let last = Date.now(), beat = Date.now(), active = false;
    const mark = () => { last = Date.now(); active = true; };
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const id = setInterval(() => {
      const now = Date.now();
      if (now - last > IDLE_MS) {
        api.logout().catch(() => undefined).finally(() => { api.session.clear(); setUser(null); setNotice('Anda keluar otomatis karena tidak ada aktivitas selama 40 menit.'); go('/masuk'); });
      } else if (active && now - beat > 4 * 60_000) { beat = now; active = false; api.heartbeat().catch(() => undefined); }
    }, 15_000);
    return () => { evs.forEach((e) => window.removeEventListener(e, mark)); clearInterval(id); };
  }, [user]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const onAuth = (u: User) => { api.session.save(u); setUser(u); go(u.role === 'ADMIN' ? '/admin' : '/'); };
  const logout = () => { api.logout().catch(() => undefined).finally(() => { api.session.clear(); setUser(null); go('/'); }); };

  const needsLogin = route === '/riwayat' || route === '/profil';
  const shown: Route = needsLogin && !user ? '/masuk' : route === '/admin' && user?.role !== 'ADMIN' ? '/' : route;
  const openChat = () => { if (!user) { setNotice('Masuk dulu untuk menghubungi admin.'); go('/masuk'); } else setChatOpen(true); };
  const link = (to: Route, label: string) => <a href={`#${to}`} className={shown === to ? 'active' : ''}>{label}</a>;

  return (
    <div className="app">
      {import.meta.env.VITE_MOCK && <div className="demoBanner" role="note"><strong>MODE DEMO</strong> untuk presentasi tugas kuliah. Data hanya ada di browser ini dan pembayaran hanyalah simulasi. Jangan transfer uang sungguhan.</div>}
      <header className="topbar">
        <a className="brand" href="#/" onClick={() => { setStoreKey((k) => k + 1); window.scrollTo(0, 0); }}><span className="mark">M</span>MYTHTOPPLACE</a>
        <nav>
          {user && <a href="#/profil" className={shown === '/profil' || shown === '/riwayat' ? 'active' : ''}><Avatar url={profile?.avatarUrl} name={profile?.fullName || user.email} size={22} /> Profil</a>}
          {user && link('/riwayat', 'Riwayat')}
          {user?.role === 'ADMIN' && link('/admin', 'Admin')}
          {user ? <button className="btn ghost sm" onClick={logout}>Keluar</button> : <a className="btn ghost sm" href="#/masuk">Masuk</a>}
        </nav>
      </header>
      <main className="container">
        <div className="page" key={shown}>
          {shown === '/' && <Store key={storeKey} user={user} notify={setNotice} />}
          {(shown === '/masuk' || shown === '/daftar') && <Auth mode={shown} onAuth={onAuth} />}
          {(shown === '/riwayat' || shown === '/profil') && <Profile tab={shown === '/riwayat' ? 'riwayat' : 'data'} notify={setNotice} onProfile={setProfile} />}
          {shown === '/admin' && <Suspense fallback={<Skeleton n={3} />}><Admin notify={setNotice} /></Suspense>}
        </div>
      </main>
      <footer className="foot">
        <p className="footText">MYTHTOPPLACE · pesanan diverifikasi admin sebelum selesai</p>
        {user?.role !== 'ADMIN' && (
          <button className="btn ghost sm chatBtn" onClick={openChat} aria-label="Hubungi admin">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Hubungi admin{unread > 0 && <span className="badgeN">{unread}</span>}
          </button>
        )}
      </footer>
      {chatOpen && user && <ChatPanel onClose={() => setChatOpen(false)} onUnread={setUnread} notify={setNotice} />}
      {notice && <div className="toast" role="status">{notice}<button aria-label="Tutup" onClick={() => setNotice('')}>×</button></div>}
    </div>
  );
}
