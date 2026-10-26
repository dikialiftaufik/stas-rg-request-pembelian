import { Link, Navigate, Outlet } from 'react-router';
import { useDemo } from '../demo/use-demo';
import { LoginPage } from './login-page';
import styles from '../dashboard/dashboard.module.css';

export function LoginRoute() {
  const { user } = useDemo();
  return user ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}
export function SessionGate() {
  const { user } = useDemo();
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
