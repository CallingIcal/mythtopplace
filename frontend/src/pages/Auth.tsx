import { useState } from 'react';
import * as api from '../api';
import type { User } from '../api';
import { EMAIL_RE, passwordError, passwordRules } from '../policy';
import { BackHome, msg } from '../ui';

export default function Auth({ mode, onAuth }: { mode: '/masuk' | '/daftar'; onAuth: (u: User) => void }) {
  const isLogin = mode === '/masuk';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit() {
    setError('');
    if (!isLogin) {
      const problem = !EMAIL_RE.test(email.trim()) ? 'Email harus mengandung @ dan titik' : passwordError(password);
      if (problem) { setError(problem); return; }
    }
    setBusy(true);
    try {
      const { user } = isLogin ? await api.login({ email, password }) : await api.register({ fullName: name, email, password });
      // Pastikan cookie sesi benar-benar tersimpan (gagal bila cookie Secure dipakai lewat http).
      await api.me().catch(() => { throw new Error('Login berhasil tetapi sesi tidak tersimpan. Jika situs dibuka lewat http (bukan https), set COOKIE_SECURE=false di server.'); });
      onAuth(user);
    }
    catch (e) { setError(msg(e)); setBusy(false); }
  }
  return (
    <div className="panel narrow">
      <BackHome />
      <h1 className="h1">{isLogin ? 'Masuk' : 'Buat akun'}</h1>
      <p className="muted">{isLogin ? 'Lanjutkan ke pesanan dan riwayatmu.' : 'Gunakan email yang belum pernah terdaftar.'}</p>
      {!isLogin && <label className="field">Nama lengkap<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
      <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      <div className="field">
        <label htmlFor="pw">Password</label>
        <div className="pw">
          <input id="pw" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? 'current-password' : 'new-password'} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button type="button" className="pwToggle" aria-pressed={show} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
            onMouseDown={(e) => e.preventDefault()} onClick={() => setShow((v) => !v)}>{show ? 'Sembunyikan' : 'Tampilkan'}</button>
        </div>
      </div>
      {!isLogin && (
        <ul className="rules" aria-label="Syarat password">
          {passwordRules(password).map(([label, ok]) => <li key={label} className={ok ? 'ok' : ''}>{ok ? '✓' : '○'} {label}</li>)}
        </ul>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy} onClick={submit}>{busy ? 'Memproses…' : isLogin ? 'Masuk' : 'Daftar'}</button>
      <a className="muted small" href={isLogin ? '#/daftar' : '#/masuk'}>{isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</a>
    </div>
  );
}
