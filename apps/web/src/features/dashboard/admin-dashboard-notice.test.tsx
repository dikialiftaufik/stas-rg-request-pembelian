import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AppProviders } from '@/test/app-providers';
import {
  DEMO_STORAGE_KEY,
  getSnapshot,
  loginDemo,
  reloadDemoState,
  logoutDemo,
} from '../demo/store';
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
function popup() {
  return screen.queryByRole('dialog', { name: 'Pemberitahuan Request' });
}
describe('pemberitahuan pertama sesi Admin', () => {
  it('merangkum semua pending, menampilkan tiga terbaru dan tidak menandai lonceng dibaca', async () => {
    renderDashboard();
    expect(popup()).toBeVisible();
    expect(popup()).toHaveAccessibleDescription(/4 request menunggu persetujuan/);
    expect(screen.getByText('Oscilloscope Digital', { selector: 'strong' })).toBeVisible();
    expect(popup()?.querySelectorAll('li')).toHaveLength(3);
    expect(getSnapshot().adminNoticeSeen).toBe(true);
    expect(document.body).toHaveAttribute('data-scroll-locked', '1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Nanti saja' }));
    expect(popup()).not.toBeInTheDocument();
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
    expect(
      getSnapshot().notifications.filter((item) => item.recipientId === 'demo-admin' && !item.read),
    ).toHaveLength(3);
  });
  it('X menutup popup, navigasi dan remount setelah refresh tidak mengulanginya', async () => {
    const user = userEvent.setup();
    const view = renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Tutup pemberitahuan' }));
    await user.click(screen.getByRole('link', { name: 'Pembelian Barang' }));
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(popup()).not.toBeInTheDocument();
    view.unmount();
    reloadDemoState();
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    expect(popup()).not.toBeInTheDocument();
  }, 15000);
  it('mendukung Escape manual dan mengulang hanya setelah login sukses berikutnya', async () => {
    const view = renderDashboard();
    await userEvent.setup().keyboard('{Escape}');
    expect(popup()).not.toBeInTheDocument();
    view.unmount();
    expect(loginDemo('admin@gmail.com', 'salah')).toBe(false);
    expect(getSnapshot().adminNoticeSeen).toBe(true);
    logoutDemo();
    renderDashboard();
    expect(popup()).toBeVisible();
  });
  it('CTA mengarah ke daftar pending tanpa menumpuk dialog', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('link', { name: 'Tinjau request' }));
    expect(window.location.pathname).toBe('/requests');
    expect(window.location.search).toBe('?status=pending_review');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('tidak menampilkan popup untuk Pengaju', () => {
    renderDashboard('pengaju');
    expect(popup()).not.toBeInTheDocument();
  });
  it('snapshot lama dibaca dan tidak menampilkan popup kosong', () => {
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
    expect(popup()).not.toBeInTheDocument();
    expect(getSnapshot().adminNoticeSeen).toBe(true);
  });
});
