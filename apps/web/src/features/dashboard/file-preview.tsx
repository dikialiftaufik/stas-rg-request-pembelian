import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import styles from './dashboard.module.css';
const PdfPreview = lazy(() => import('./pdf-preview'));
export function FilePreview({ blob, name }: { blob: Blob; name: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const value = URL.createObjectURL(blob);
    queueMicrotask(() => setUrl(value));
    return () => URL.revokeObjectURL(value);
  }, [blob]);
  return (
    <div className={styles.filePreview}>
      {url && (
        <div className={styles.previewControls}>
          <a className={styles.secondaryButton} href={url} target="_blank" rel="noreferrer">
            <ArrowTopRightOnSquareIcon aria-hidden="true" />
            Buka file
          </a>
          <a
            className={styles.secondaryButton}
            href={url}
            download={name}
            aria-label={`Unduh ${name}`}
          >
            <ArrowDownTrayIcon aria-hidden="true" />
            Unduh file
          </a>
        </div>
      )}
      {blob.type === 'application/pdf' ? (
        <Suspense fallback={<p role="status">Memuat pratinjau…</p>}>
          <PdfPreview blob={blob} />
        </Suspense>
      ) : blob.type.startsWith('image/') && url ? (
        <img src={url} alt={`Pratinjau ${name}`} width={640} height={480} />
      ) : (
        <p className={styles.hint}>Daftar barang dari dokumen ini tersedia pada tabel di bawah.</p>
      )}
    </div>
  );
}
