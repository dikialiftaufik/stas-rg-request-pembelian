import { describe, expect, it } from 'vitest';
import { parseClientEnvironment } from './environment';
import { cn } from './utils';

describe('konfigurasi public frontend', () => {
  it('menggunakan default yang tidak menyimpan secret dan tidak menyalakan mock', () => {
    expect(parseClientEnvironment({})).toEqual({ apiBaseUrl: '/api/v1', enableMocks: false });
  });
  it('mengaktifkan mock hanya dengan nilai true yang eksplisit', () => {
    expect(parseClientEnvironment({ VITE_ENABLE_MOCKS: 'true' }).enableMocks).toBe(true);
    expect(parseClientEnvironment({ VITE_ENABLE_MOCKS: 'false' }).enableMocks).toBe(false);
  });
  it.each([
    'https://api.example.test/api/v1',
    'http://localhost:3000/api/v1',
    'http://127.0.0.1:3000/api/v1',
  ])('menerima endpoint yang sesuai aturan %s', (value) => {
    expect(parseClientEnvironment({ VITE_API_BASE_URL: value }).apiBaseUrl).toBe(value);
  });
  it.each(['//example.test/api', 'javascript:alert(1)', 'http://example.test/api', 'bukan-url'])(
    'menolak endpoint yang tidak aman %s',
    (value) => {
      expect(() => parseClientEnvironment({ VITE_API_BASE_URL: value })).toThrow();
    },
  );
  it('menolak flag yang dapat salah ditafsirkan sebagai boolean', () => {
    expect(() => parseClientEnvironment({ VITE_ENABLE_MOCKS: 'yes' })).toThrow();
  });
  it('menggabungkan class tanpa mempertahankan utility yang bertentangan', () => {
    expect(cn('px-2', false, 'px-4')).toBe('px-4');
  });
});
