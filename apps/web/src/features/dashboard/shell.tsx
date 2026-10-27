import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useDemoLogout } from '../auth/use-demo-logout';
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BeakerIcon,
  BellIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import logoUrl from '../../../../../assets/img/logo-stas-rg.png';
import { useDemo } from '../demo/use-demo';
import { markNotificationsRead } from '../demo/store';
import { Modal } from './shared';
import styles from './dashboard.module.css';

function SidebarContent({
  onNavigate,
  collapsed,
  onCollapse,
}: {
  onNavigate?: () => void;
  collapsed: boolean;
  onCollapse?: () => void;
}) {
  const { user } = useDemo();
  const { mutate: logout } = useDemoLogout();
  const CollapseIcon = collapsed ? ChevronDoubleRightIcon : ChevronDoubleLeftIcon;
  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: Squares2X2Icon },
    { to: '/requests', label: 'Request Pembelian', icon: ShoppingCartIcon },
    ...(user?.role === 'admin'
      ? [
          { to: '/users', label: 'Manajemen Pengguna', icon: UsersIcon },
          { to: '/research-types', label: 'Jenis Riset', icon: BeakerIcon },
        ]
      : []),
  ];
  return (
    <>
      <div className={styles.sidebarBrand}>
        <img src={logoUrl} width={40} height={48} alt="STAS Research Group" />
        <span className={styles.navText}>STAS-RG</span>
        {onCollapse && (
          <button
            className={styles.iconButton}
            type="button"
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            onClick={onCollapse}
          >
            <CollapseIcon aria-hidden="true" />
          </button>
        )}
      </div>
      <nav className={styles.navigation} aria-label="Navigasi utama">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            className={styles.navItem ?? ''}
            key={to}
            to={to}
            aria-label={label}
            title={collapsed ? label : undefined}
            onClick={onNavigate}
          >
            <Icon aria-hidden="true" />
            <span className={styles.navText}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={styles.logoutArea}>
        <button
          className={styles.navItem}
          type="button"
          aria-label="Keluar"
          onClick={() => logout()}
        >
          <ArrowRightStartOnRectangleIcon aria-hidden="true" />
          <span className={styles.navText}>Keluar</span>
        </button>
      </div>
    </>
  );
}

export function DashboardShell() {
  const { data, user } = useDemo();
  const { mutate: logout } = useDemoLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [overlay, setOverlay] = useState<'menu' | 'notifications' | 'profile' | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.title;
    const titles: Record<string, string> = {
      '/dashboard': 'Dashboard Pengadaan',
      '/requests': 'Request Pembelian',
      '/users': 'Manajemen Pengguna',
      '/research-types': 'Jenis Riset',
    };
    document.title = `${titles[location.pathname] ?? 'STAS-RG'} | STAS-RG Procurement Portal`;
    window.scrollTo(0, 0);
    if (!document.querySelector('[role="dialog"], [role="alertdialog"]')) {
      mainRef.current?.focus({ preventScroll: true });
    }
    return () => {
      document.title = previous;
    };
  }, [location.pathname]);
  if (!user) return null;
  const notifications = data.notifications.filter((item) => item.recipientId === user.id);
  const unread = notifications.filter((item) => !item.read).length;
  const close = () => setOverlay(null);
  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      <a className={styles.skipLink} href="#dashboard-content">
        Langsung ke konten
      </a>
      <aside className={styles.sidebar} aria-label="Menu aplikasi">
        <SidebarContent collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} />
      </aside>
      <header className={styles.topbar}>
        <button
          className={`${styles.iconButton} ${styles.menuButton}`}
          type="button"
          aria-label="Buka menu navigasi"
          aria-expanded={overlay === 'menu'}
          onClick={() => setOverlay('menu')}
        >
          <Bars3Icon aria-hidden="true" />
        </button>
        <button
          className={`${styles.iconButton} ${styles.notificationButton}`}
          type="button"
          aria-label={`Notifikasi, ${unread} belum dibaca`}
          onClick={() => setOverlay('notifications')}
        >
          <BellIcon aria-hidden="true" />
          {unread > 0 && (
            <span className={styles.notificationCount} aria-hidden="true">
              {unread}
            </span>
          )}
        </button>
        <button
          className={styles.profileButton}
          type="button"
          aria-label="Buka profil"
          onClick={() => setOverlay('profile')}
        >
          <span className={styles.avatar}>
            <UserIcon aria-hidden="true" />
          </span>
          {user.role === 'admin' ? 'Admin' : 'Pengaju'}
        </button>
      </header>
      <main ref={mainRef} tabIndex={-1} className={styles.main} id="dashboard-content">
        <Outlet />
      </main>
      {overlay === 'menu' && (
        <Modal title="Menu navigasi" onClose={close} drawer>
          <div className={styles.mobileMenu}>
            <SidebarContent collapsed={false} onNavigate={close} />
          </div>
        </Modal>
      )}
      {overlay === 'profile' && (
        <Modal title="Profil Pengguna" onClose={close}>
          <dl className={styles.detailGrid}>
            <div>
              <dt>Nama</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Peran</dt>
              <dd>{user.role === 'admin' ? 'Admin' : 'Pengaju'}</dd>
            </div>
            <div>
              <dt>Lingkungan</dt>
              <dd>Mode demo · Data contoh</dd>
            </div>
          </dl>
          <div className={styles.dialogActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => logout()}>
              Keluar
            </button>
          </div>
        </Modal>
      )}
      {overlay === 'notifications' && (
        <Modal title="Notifikasi" onClose={close}>
          <div className={styles.toolbar}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={unread === 0}
              onClick={() => markNotificationsRead()}
            >
              Tandai semua dibaca
            </button>
          </div>
          <div className={styles.noticeList}>
            {notifications.map((item) => (
              <article key={item.id} className={styles.noticeItem} data-unread={!item.read}>
                <p>{item.message}</p>
                <div className={styles.noticeActions}>
                  {!item.read && (
                    <button type="button" onClick={() => markNotificationsRead([item.id])}>
                      Tandai dibaca
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationsRead([item.id]);
                      close();
                      void navigate(`/requests?detail=${encodeURIComponent(item.requestId)}`);
                    }}
                  >
                    Buka request
                  </button>
                </div>
              </article>
            ))}
            {notifications.length === 0 && <p className={styles.empty}>Belum ada notifikasi.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
