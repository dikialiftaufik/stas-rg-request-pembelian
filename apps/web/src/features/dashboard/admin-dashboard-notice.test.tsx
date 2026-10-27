import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AppProviders } from '@/test/app-providers';
import { DEMO_STORAGE_KEY, getSnapshot, loginDemo, reloadDemoState } from '../demo/store';
import { createSeed } from '../demo/seed';

function renderDashboard(role: 'admin' | 'pengaju' = 'admin') {
  loginDemo(`${role}@gmail.com`, `${role}123`);
  window.history.replaceState({}, '', '/dashboard');
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe('hard popup dashboard', () => {
  it('menampilkan pesan dari data aktual dan mengharuskan penutupan manual', async () => {
    const user = userEvent.setup();
    renderDashboard();
    const notice = screen.getByRole('alertdialog', { name: 'Pemberitahuan Request' });
    expect(notice).toBeVisible();
    expect(screen.getByText('1 dari 3')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Persetujuan diperlukan: Oscilloscope Digital' }),
    ).toHaveFocus();
    expect(notice).toHaveAccessibleDescription(/Ir. Citra Dewi.*Rp 12.500.000/);
    expect(document.body).toHaveAttribute('data-scroll-locked', '1');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(notice).toBeVisible();
    await user.click(notice);
    expect(notice).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Nanti saja' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(
      getSnapshot().notifications.filter((item) => item.recipientId === 'demo-admin' && !item.read),
    ).toHaveLength(3);
  });
  it('tombol X menutup popup dan kembali ke dashboard memunculkannya lagi', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Tutup pemberitahuan' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Request Pembelian' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
  });
  it('Tinjau Request membuka detail yang benar dan menandai pemberitahuan tersebut dibaca', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Tinjau Request' }));
    expect(await screen.findByRole('dialog', { name: 'Detail Request Pembelian' })).toBeVisible();
    expect(window.location.pathname).toBe('/requests');
    expect(window.location.search).toBe('?detail=request-1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(getSnapshot().notifications.find((item) => item.id === 'notice-1')?.read).toBe(true);
  });
  it('tidak menampilkan hard popup untuk Pengaju', () => {
    renderDashboard('pengaju');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });
  it('menyediakan penutupan manual ketika tidak ada request pending', async () => {
    const data = createSeed();
    sessionStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        ...data,
        accountId: 'demo-admin',
        requests: data.requests.map((item) => ({ ...item, status: 'approved' })),
      }),
    );
    reloadDemoState();
    window.history.replaceState({}, '', '/dashboard');
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByText('Tidak ada request menunggu persetujuan')).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Lanjut ke Dashboard' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
