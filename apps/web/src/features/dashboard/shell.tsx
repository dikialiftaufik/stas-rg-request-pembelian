import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router';
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
    { to: '/requests', label: 'Pembelian Barang', icon: ShoppingCartIcon },
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
  const [collapsed, setCollapsed] = useState(false);
  const [overlay, setOverlay] = useState<'menu' | null>(null);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.title;
    const titles = new Map(
      Object.entries({
        '/dashboard': 'Dashboard',
        '/requests': 'Pembelian Barang',
        '/users': 'Manajemen Pengguna',
        '/research-types': 'Jenis Riset',
        '/profile': 'Profil Pengguna',
        '/notifications': 'Notifikasi',
      }),
    );
    const path = location.pathname;
    const section = path.startsWith('/requests/rab')
      ? 'RAB'
      : path.startsWith('/requests')
        ? 'Pembelian Barang'
        : path.startsWith('/users')
          ? 'Pengguna'
          : path.startsWith('/research-types')
            ? 'Jenis Riset'
            : 'STAS-RG';
    const tail = path.split('/').at(-1);
    const actionTitles = new Map([
      ['new', `Tambah ${section}`],
      ['edit', `Edit ${section}`],
      ['status', 'Ubah status pembelian'],
      ['invoice', 'Invoice Pembelian Barang'],
      ['replacement', 'Penawaran pengganti'],
      ['import', 'Impor RAB'],
    ]);
    document.title = `${titles.get(path) ?? actionTitles.get(tail ?? '') ?? `Detail ${section}`} | STAS-RG Pembelian Barang`;
    let restored = 0;
    try {
      restored =
        Number(
          sessionStorage.getItem(`stas-scroll:${location.pathname}${window.location.search}`),
        ) || 0;
    } catch {
      /* Navigation works without storage. */
    }
    requestAnimationFrame(() => window.scrollTo(0, restored));
    if (!document.querySelector('[role="dialog"]')) {
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
        <span className={styles.workspaceName}>Pembelian Barang</span>
        <button
          className={`${styles.iconButton} ${styles.menuButton}`}
          type="button"
          aria-label="Buka menu navigasi"
          aria-expanded={overlay === 'menu'}
          onClick={() => setOverlay('menu')}
        >
          <Bars3Icon aria-hidden="true" />
        </button>
        <span className={styles.demoBadge}>Mode demo · Data contoh</span>
        <Link
          className={`${styles.iconButton} ${styles.notificationButton}`}
          aria-label={`Notifikasi, ${unread} belum dibaca`}
          to="/notifications"
        >
          <BellIcon aria-hidden="true" />
          {unread > 0 && (
            <span className={styles.notificationCount} aria-hidden="true">
              {unread}
            </span>
          )}
        </Link>
        <Link
          className={styles.profileButton}
          aria-label={`Buka profil ${user.role === 'admin' ? 'Admin' : 'Pengaju'}`}
          to="/profile"
        >
          <span className={styles.avatar}>
            <UserIcon aria-hidden="true" />
          </span>
          {user.role === 'admin' ? 'Admin' : 'Pengaju'}
        </Link>
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
    </div>
  );
}
