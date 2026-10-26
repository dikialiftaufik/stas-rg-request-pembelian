import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { AppProviders } from './providers';

function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe('fondasi frontend', () => {
  it('menampilkan halaman awal tanpa koneksi backend', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Frontend STAS-RG siap' })).toBeVisible();
    expect(screen.getByText(/belum dihubungkan ke backend/)).toBeVisible();
  });
  it('berpindah route melalui React Router dan kembali', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Tentang workspace' }));
    expect(screen.getByRole('heading', { name: 'Tentang workspace' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Kembali ke beranda' }));
    expect(screen.getByRole('heading', { name: 'Frontend STAS-RG siap' })).toBeVisible();
  });
  it('menampilkan notifikasi dari Sonner', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Uji notifikasi' }));
    expect(await screen.findByText('Notifikasi frontend bekerja.')).toBeVisible();
  });
  it('memberikan jalur kembali untuk route yang tidak dikenal', () => {
    window.history.replaceState({}, '', '/tidak-ada');
    renderApp();
    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Kembali ke beranda' })).toHaveAttribute('href', '/');
  });
});
