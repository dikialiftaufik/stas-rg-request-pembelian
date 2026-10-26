import { useEffect } from 'react';
import logoUrl from '../../../../../assets/img/logo-stas-rg.png';
import { LoginBrandPanel } from './login-brand-panel';
import { LoginForm } from './login-form';
import styles from './login.module.css';

export function LoginPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Masuk | STAS-RG Procurement Portal';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#konten">
        Langsung ke konten
      </a>
      <div className={styles.formPanel}>
        <header>
          <img
            className={styles.logo}
            src={logoUrl}
            alt="STAS Research Group"
            width={80}
            height={80}
          />
        </header>
        <main id="konten" tabIndex={-1} className={styles.content}>
          <h1 className={styles.welcomeTitle}>
            Selamat datang <br />
            kembali.
          </h1>
          <p className={styles.introduction}>
            Masuk untuk mengelola pengadaan dan menjaga riset STAS-RG tetap bergerak.
          </p>
          <LoginForm />
        </main>
        <footer className={styles.copyright}>
          © {new Date().getFullYear()} STAS-RG · Procurement Portal
        </footer>
      </div>
      <LoginBrandPanel />
    </div>
  );
}
