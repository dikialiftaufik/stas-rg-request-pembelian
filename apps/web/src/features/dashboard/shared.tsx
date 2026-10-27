import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ThemedSelect } from '@/components/ui/themed-select';
import type { RequestStatus } from '../demo/model';
import { statusLabelMap } from '../demo/model';
import { Field as UIField, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field';
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
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const Root = drawer ? Sheet : Dialog;
  const Content = drawer ? SheetContent : DialogContent;
  return (
    <Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Content
        ref={ref}
        {...(drawer ? { side: 'left' as const } : {})}
        role={role}
        aria-describedby={descriptionId}
        showCloseButton={false}
        className={`${styles.dialog} ${wide ? styles.wideDialog : ''} ${drawer ? styles.drawerDialog : ''} ${className ?? ''}`}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          previous.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const target =
            ref.current?.querySelector<HTMLElement>(
              '[data-initial-focus], input:not([disabled]), button[role="combobox"], textarea',
            ) ?? ref.current?.querySelector<HTMLElement>('button');
          target?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previous.current?.isConnected && previous.current !== document.body)
            previous.current.focus({ preventScroll: true });
          else document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
        }}
        onEscapeKeyDown={(event) => {
          if (!closeOnEscape) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <header className={styles.dialogHeader}>
          {headerIcon && <span className={styles.dialogHeaderIcon}>{headerIcon}</span>}
          <div className={styles.dialogHeading}>
            <DialogTitle asChild>
              <h2>{title}</h2>
            </DialogTitle>
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
      </Content>
    </Root>
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
    <UIField className={styles.field} data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {hint && <FieldDescription className={styles.hint}>{hint}</FieldDescription>}
      {error && (
        <FieldError id={`${id}-error`} className={styles.formError} role="alert">
          {error}
        </FieldError>
      )}
    </UIField>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge className={styles.statusBadge} data-status={status}>
      {statusLabelMap.get(status)}
    </Badge>
  );
}

export function PageHeading({
  title,
  description,
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
  return (
    <div className={styles.pagination}>
      <span>
        Menampilkan {count ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, count)} dari{' '}
        {count} data
      </span>
      <div className={styles.paginationControls}>
        <div className={styles.pageSize}>
          <span>Tampilkan</span>
          <ThemedSelect
            label="Tampilkan"
            value={String(pageSize)}
            onValueChange={(value) => onPageSize(Number(value))}
            options={[5, 10, 20].map((size) => ({ value: String(size), label: String(size) }))}
          />
        </div>
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
