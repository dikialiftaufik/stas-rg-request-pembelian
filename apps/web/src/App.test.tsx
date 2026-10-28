import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { AppProviders } from '@/test/app-providers';
import { loginDemo } from './features/demo/store';

function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe('halaman login', () => {
  it('menampilkan form dengan password tersembunyi dan tanpa error awal', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Selamat datang kembali.');
    expect(document.title).toBe('Masuk | STAS-RG Pembelian Barang');
    expect(screen.getByRole('img', { name: 'STAS Research Group' })).toBeVisible();
    expect(screen.getByLabelText('ID / NIM / EMAIL')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('PASSWORD')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('PASSWORD')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByText(/Akun dibuat dan dikelola oleh Admin STAS-RG/)).toBeVisible();
  });

  it('memvalidasi field wajib dan memfokuskan kesalahan pertama', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Masuk ke Dashboard' }));
    expect(await screen.findByText('Masukkan ID, NIM, atau email Anda.')).toBeVisible();
    expect(screen.getByText('Masukkan password Anda.')).toBeVisible();
    expect(screen.getByLabelText('ID / NIM / EMAIL')).toHaveFocus();
    expect(screen.getByLabelText('ID / NIM / EMAIL')).toHaveAccessibleDescription(
      'Masukkan ID, NIM, atau email Anda.',
    );
    expect(screen.getByLabelText('PASSWORD')).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByLabelText('ID / NIM / EMAIL'), 'STAS-001');
    await waitFor(() => {
      expect(screen.queryByText('Masukkan ID, NIM, atau email Anda.')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Masukkan password Anda.')).toBeVisible();
  });

  it('menolak identitas yang hanya berisi spasi', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('ID / NIM / EMAIL'), '   ');
    await user.type(screen.getByLabelText('PASSWORD'), 'password');
    await user.click(screen.getByRole('button', { name: 'Masuk ke Dashboard' }));
    expect(await screen.findByText('Masukkan ID, NIM, atau email Anda.')).toBeVisible();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('mengubah visibilitas password tanpa mengubah nilai atau mengirim form', async () => {
    const user = userEvent.setup();
    renderApp();
    const password = screen.getByLabelText('PASSWORD');
    const toggle = screen.getByRole('button', { name: 'Tampilkan password' });
    await user.type(password, ' password dengan spasi ');
    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue(' password dengan spasi ');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveValue(' password dengan spasi ');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it.each(['STAS-001', '2026123456', 'peneliti@example.com'])(
    'menolak identitas yang tidak terdaftar: %s',
    async (identifier) => {
      const user = userEvent.setup();
      renderApp();
      await user.type(screen.getByLabelText('ID / NIM / EMAIL'), identifier);
      await user.type(screen.getByLabelText('PASSWORD'), ' password ');
      await user.keyboard('{Enter}');
      expect(await screen.findByText('Email atau password salah.')).toBeVisible();
      expect(window.location.pathname).toBe('/');
      expect(screen.getByLabelText('PASSWORD')).toHaveValue(' password ');
      await user.type(screen.getByLabelText('ID / NIM / EMAIL'), '2');
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(screen.queryByText('Email atau password salah.')).not.toBeInTheDocument();
    },
  );
});

describe('akses dashboard demo', () => {
  it.each([
    ['admin', 'admin@gmail.com', 'admin123'],
    ['pengaju', 'pengaju@gmail.com', 'pengaju123'],
  ])(
    'membuka dashboard untuk %s',
    async (role, email, password) => {
      const user = userEvent.setup();
      renderApp();
      await user.type(screen.getByLabelText('ID / NIM / EMAIL'), email);
      await user.type(screen.getByLabelText('PASSWORD'), password);
      await user.click(screen.getByRole('button', { name: 'Masuk ke Dashboard' }));
      await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
      if (role !== 'admin')
        expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
      expect(window.location.pathname).toBe('/dashboard');
      if (role === 'admin') {
        expect(await screen.findByRole('dialog', { name: 'Pemberitahuan Request' })).toBeVisible();
        await user.click(screen.getByRole('button', { name: 'Nanti saja' }));
        expect(screen.getByRole('link', { name: 'Manajemen Pengguna' })).toBeVisible();
      } else {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Manajemen Pengguna' })).not.toBeInTheDocument();
      }
      await user.click(screen.getByRole('button', { name: 'Keluar' }));
      expect(await screen.findByLabelText('ID / NIM / EMAIL')).toBeVisible();
    },
    15000,
  );
  it('mengarahkan tamu dari dashboard ke login', () => {
    window.history.replaceState({}, '', '/dashboard');
    renderApp();
    expect(screen.getByLabelText('ID / NIM / EMAIL')).toBeVisible();
    expect(window.location.pathname).toBe('/');
  });
  it('menolak akses langsung Pengaju ke manajemen pengguna', () => {
    loginDemo('pengaju@gmail.com', 'pengaju123');
    window.history.replaceState({}, '', '/users');
    renderApp();
    expect(screen.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible();
    expect(screen.queryByText('hasan@example.test')).not.toBeInTheDocument();
  });
});

describe('rute workspace', () => {
  it('mempertahankan halaman tentang dan dapat kembali ke login', async () => {
    window.history.replaceState({}, '', '/tentang');
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('heading', { name: 'Tentang STAS-RG' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Kembali ke beranda' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Selamat datang kembali.');
    expect(screen.queryByText('Frontend lokal')).not.toBeInTheDocument();
  });

  it('memberikan jalur kembali dari route yang tidak dikenal', async () => {
    window.history.replaceState({}, '', '/tidak-ada');
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Kembali ke beranda' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Selamat datang kembali.');
  });
});
