import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router'],
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    server: { deps: { inline: ['@refinedev/react-router'] } },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/mocks/**',
        'src/vite-env.d.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
});
