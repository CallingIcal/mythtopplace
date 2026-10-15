import { useEffect, useState } from 'react';

export type Route = '/' | '/masuk' | '/daftar' | '/riwayat' | '/profil' | '/admin';
const ROUTES: Route[] = ['/', '/masuk', '/daftar', '/riwayat', '/profil', '/admin'];
const read = (): Route => {
  const p = location.hash.replace(/^#/, '') || '/';
  return (ROUTES as string[]).includes(p) ? (p as Route) : '/';
};

/** Routing berbasis hash: tombol Back berfungsi, tanpa konfigurasi server tambahan. */
export const go = (r: Route) => { location.hash = r; };

export function useRoute() {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
