import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { RequestStatus } from '../demo/model';
import { statusLabelMap } from '../demo/model';
import styles from './dashboard.module.css';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    const target =
      dialog?.querySelector<HTMLElement>('[data-initial-focus]') ??
      dialog?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea',
      ) ??
      dialog?.querySelector<HTMLElement>('button');
    target?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('main')?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`${styles.dialog} ${wide ? styles.wideDialog : ''} ${drawer ? styles.drawerDialog : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
    >
      <header className={styles.dialogHeader}>
        <h2 id={titleId}>{title}</h2>
        <button
          className={styles.iconButton}
          type="button"
          aria-label="Tutup dialog"
          onClick={onClose}
        >
          <XMarkIcon aria-hidden="true" />
        </button>
      </header>
      <div className={styles.dialogBody}>{children}</div>
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <p className={styles.dialogDescription}>{description}</p>
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.dialogActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          data-initial-focus
          onClick={onClose}
        >
          Kembali
        </button>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => {
            try {
              onConfirm();
              onClose();
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'Tindakan gagal. Silakan coba lagi.',
              );
            }
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
      {error && (
        <p id={`${id}-error`} className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      <span aria-hidden="true" />
      {statusLabelMap.get(status)}
    </span>
  );
}

export function PageHeading({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.pageHeading}>
      <div>
        {eyebrow && <p className={styles.pageEyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Pagination({
  count,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  count: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const sizeId = useId();
  return (
    <div className={styles.pagination}>
      <span>
        Menampilkan {count ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, count)} dari{' '}
        {count} data
      </span>
      <div className={styles.paginationControls}>
        <label htmlFor={sizeId}>
          Tampilkan{' '}
          <select
            id={sizeId}
            value={pageSize}
            onInput={(event) => onPageSize(Number(event.currentTarget.value))}
          >
            {[5, 10, 20].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>
          Halaman {page} dari {pages}
        </span>
        <button
          type="button"
          aria-label="Halaman sebelumnya"
          className={styles.iconButton}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Halaman berikutnya"
          className={styles.iconButton}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
