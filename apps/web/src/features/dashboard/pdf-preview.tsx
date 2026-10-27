import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openPdf } from '../demo/pdf-loader';
import styles from './dashboard.module.css';
export default function PdfPreview({ blob }: { blob: Blob }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    void openPdf(blob)
      .then((pdf) => {
        loaded = pdf;
        if (cancelled) {
          void pdf.loadingTask.destroy();
          return;
        }
        setDocument(pdf);
        setPage(1);
      })
      .catch(() => {
        if (!cancelled)
          setError('PDF tidak dapat dipratinjau. Pilih file PDF yang tidak rusak dan tanpa sandi.');
      });
    return () => {
      cancelled = true;
      if (loaded) void loaded.loadingTask.destroy();
    };
  }, [blob]);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    const target = canvas.current;
    void document
      .getPage(page)
      .then((pdfPage) => {
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale: 1.4 });
        target.width = viewport.width;
        target.height = viewport.height;
        const context = target.getContext('2d');
        if (!context) throw new Error('Canvas tidak tersedia');
        const task = pdfPage.render({ canvas: target, canvasContext: context, viewport });
        cancelRender = () => task.cancel();
        return task.promise;
      })
      .catch(() => {
        if (!cancelled)
          setError('Halaman PDF tidak dapat ditampilkan. Coba halaman lain atau buka file.');
      });
    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [document, page]);
  return (
    <div className={styles.pdfPreview}>
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : !document ? (
        <p role="status">Memuat PDF…</p>
      ) : (
        <>
          <div className={styles.previewControls}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {page} dari {document.numPages}
            </span>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={page >= document.numPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Berikutnya
            </button>
          </div>
        </>
      )}
      <canvas ref={canvas} role="img" aria-label={`Pratinjau PDF halaman ${page}`} />
    </div>
  );
}
