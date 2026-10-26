import { SparklesIcon } from '@heroicons/react/24/outline';
import styles from './login.module.css';

export function LoginBrandPanel() {
  return (
    <aside className={styles.brandPanel} aria-label="Tentang STAS Research Group">
      <div className={styles.orbits} aria-hidden="true" />
      <SparklesIcon className={styles.sparkles} aria-hidden="true" />
      <div className={styles.brandContent}>
        <p className={styles.eyebrow}>Procurement research workspace</p>
        <h2 className={styles.brandTitle}>
          Dari ide, menjadi <br />
          dampak.
        </h2>
        <p className={styles.brandDescription}>
          Ajukan kebutuhan, pantau proses, dan buat setiap keputusan pengadaan lebih terarah.
        </p>
      </div>
      <div className={styles.brandSignature}>
        <span className={styles.monogram} aria-hidden="true">
          RG
        </span>
        <div>
          <p className={styles.groupName}>STAS Research Group</p>
          <p className={styles.platformName}>Procurement platform</p>
        </div>
      </div>
    </aside>
  );
}
