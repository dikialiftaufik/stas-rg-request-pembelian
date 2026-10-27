import logoUrl from '../../../../../assets/img/logo-stas-rg.png';
import styles from './login.module.css';

export function LoginBrandPanel() {
  return (
    <aside className={styles.brandPanel} aria-label="Tentang STAS Research Group">
      <div className={styles.brandContent}>
        <h2 className={styles.brandTitle}>
          Dari ide, menjadi <br />
          dampak.
        </h2>
        <p className={styles.brandDescription}>
          Ajukan kebutuhan, pantau pembelian, dan dukung kelancaran riset.
        </p>
      </div>
      <div className={styles.brandSignature}>
        <span className={styles.monogram} aria-hidden="true">
          <img src={logoUrl} alt="" width={32} height={38} />
        </span>
        <div>
          <p className={styles.groupName}>STAS Research Group</p>
          <p className={styles.platformName}>Pembelian Barang</p>
        </div>
      </div>
    </aside>
  );
}
