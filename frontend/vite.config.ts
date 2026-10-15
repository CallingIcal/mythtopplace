import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode mock` menghasilkan satu file HTML mandiri (demo tanpa backend).
export default defineConfig(({ mode }) => ({
  base: mode === 'mock' ? './' : '/',
  plugins: [react(), ...(mode === 'mock' ? [viteSingleFile()] : [])],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { target: 'es2020' },
}));
