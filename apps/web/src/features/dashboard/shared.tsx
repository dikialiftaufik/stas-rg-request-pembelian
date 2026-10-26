import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
  closeOnEscape = true,
  headerIcon,
  subtitle,
  className,
  descriptionId,
  role = 'dialog',
  closeLabel = 'Tutup dialog',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
  closeOnEscape?: boolean;
  headerIcon?: ReactNode;
  subtitle?: string;
  className?: string | undefined;
  descriptionId?: string;
  role?: 'dialog' | 'alertdialog';
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body) {
        previous.focus();
      } else document.querySelector<HTMLElement>('main')?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={`${styles.dialog} ${wide ? styles.wideDialog : ''} ${drawer ? styles.drawerDialog : ''} ${className ?? ''}`}
      onCancel={(event) => {
        event.preventDefault();
        if (closeOnEscape) closeRef.current();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            !element.closest('[inert]') &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls.at(-1);
        const active = document.activeElement;
        if (
          (event.shiftKey && active === first) ||
          (!event.shiftKey && active === last) ||
          !controls.some((element) => element === active)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
    >
      <header className={styles.dialogHeader}>
        {headerIcon && <span className={styles.dialogHeaderIcon}>{headerIcon}</span>}
        <div className={styles.dialogHeading}>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p className={styles.dialogSubtitle}>{subtitle}</p>}
        </div>
        <button
          className={styles.iconButton}
          type="button"
          aria-label={closeLabel}
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
