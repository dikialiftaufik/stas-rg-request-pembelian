import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router'],
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { target: 'es2024', sourcemap: false },
});
