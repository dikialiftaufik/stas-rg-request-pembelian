import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet } from 'react-router';
import { useDemo } from '../demo/use-demo';
import { ensureAuthBootstrapped, isAuthBootstrapped } from './demo-auth-provider';
import { LoginPage } from './login-page';
import styles from '../dashboard/dashboard.module.css';

function useSessionReady(): boolean {
  const [ready, setReady] = useState(() => isAuthBootstrapped());

  useEffect(() => {
    if (ready) return;
    let active = true;
    void ensureAuthBootstrapped().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [ready]);

  return ready;
}

export function LoginRoute() {
  const ready = useSessionReady();
  const { user } = useDemo();
  if (!ready) {
    return (
      <p className="p-6 text-sm" role="status" aria-live="polite">
        Memeriksa sesi aktif…
      </p>
    );
  }
  return user ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

export function SessionGate() {
  const ready = useSessionReady();
  const { user } = useDemo();
  if (!ready) {
    return (
      <p className="p-6 text-sm" role="status" aria-live="polite">
        Memeriksa sesi aktif…
      </p>
    );
  }
  return user ? <Outlet /> : <Navigate to="/" replace />;
}

export function AdminGate() {
  const { user } = useDemo();
  return user?.role === 'admin' ? (
    <Outlet />
  ) : (
    <section>
      <h1 className={styles.sectionTitle}>Akses ditolak</h1>
      <p className={styles.pageDescription}>Halaman ini hanya tersedia untuk Admin.</p>
      <Link className={styles.primaryButton} to="/dashboard">
        Kembali ke Dashboard
      </Link>
    </section>
  );
}
