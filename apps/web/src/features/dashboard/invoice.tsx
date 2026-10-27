import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { FieldGroup } from '@/components/ui/field';
import { Link } from 'react-router';
import { useUnsavedChanges, useRecordNavigation, rememberScroll } from './record-navigation';
import { fieldAttributes } from './form-utils';
import {
  invoiceInputSchema,
  webUrlSchema,
  formatMoney,
  formatDate,
  requestTotal,
} from '../demo/model';
import type { DemoRequest } from '../demo/model';
import { canManageInvoice, loadInvoiceFile, saveInvoice } from '../demo/store';
import { useDemo } from '../demo/use-demo';
import { FilePreview } from './file-preview';
import { Field } from './shared';
import styles from './dashboard.module.css';
const formSchema = invoiceInputSchema.extend({ url: webUrlSchema });
type InvoiceValues = z.infer<typeof formSchema>;
export function InvoiceContent({ request }: { request: DemoRequest }) {
  const { user } = useDemo();
  const invoice = request.invoice;
  const [editing, setEditing] = useState(!invoice);
  const [file, setFile] = useState<File | undefined>();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<InvoiceValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: invoice?.number ?? '',
      amount: invoice?.amount ?? '',
      invoiceDate: invoice?.invoiceDate ?? '',
      url: invoice?.url ?? '',
    },
  });
  const [expected, setExpected] = useState(invoice?.updatedAt ?? null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ fileId?: string; blob?: Blob; error?: string }>({});
  useEffect(() => {
    let active = true;
    const fileId = invoice?.file?.id;
    if (invoice?.file)
      void loadInvoiceFile(request.id)
        .then((blob) => {
          if (active && fileId) setPreview({ fileId, blob });
        })
        .catch((cause: unknown) => {
          if (active)
            setPreview({
              ...(fileId ? { fileId } : {}),
              error: cause instanceof Error ? cause.message : 'File tidak tersedia.',
            });
        });
    return () => {
      active = false;
    };
  }, [request.id, invoice?.file]);
  const allowed = user?.role === 'admin' && canManageInvoice(request.status);
  const { guard, markSaved, resetSaved } = useUnsavedChanges(editing && (isDirty || !!file), busy);
  const changed = Boolean(file || isDirty);
  const submit = handleSubmit(async (values) => {
    setError('');
    if (invoice && !confirmed) {
      setError('Konfirmasikan penggantian invoice aktif terlebih dahulu.');
      return;
    }
    setBusy(true);

    try {
      await saveInvoice({ requestId: request.id, file, ...values, expectedUpdatedAt: expected });
      markSaved();
      toast.success('Invoice berhasil disimpan.');
      setEditing(false);
      setFile(undefined);
      setConfirmed(false);
      reset(values);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Invoice gagal disimpan. Silakan coba lagi.',
      );
    } finally {
      setBusy(false);
    }
  });
  return (
    <section aria-label={`Invoice ${request.item}`}>
      <h3 className={styles.sectionTitle}>{request.item}</h3>
      {invoice && (
        <>
          <dl className={styles.detailGrid}>
            <div>
              <dt>No. invoice</dt>
              <dd>{invoice.number ?? 'Belum dilengkapi'}</dd>
            </div>
            <div>
              <dt>Total invoice</dt>
              <dd className={styles.pageTotal}>
                {invoice.amount ? formatMoney(invoice.amount) : 'Belum dilengkapi'}
              </dd>
            </div>
            <div>
              <dt>Tanggal invoice</dt>
              <dd>{invoice.invoiceDate ? formatDate(invoice.invoiceDate) : 'Belum dilengkapi'}</dd>
            </div>
            <div>
              <dt>Nilai request</dt>
              <dd>{formatMoney(requestTotal(request))}</dd>
            </div>
            <div>
              <dt>Selisih nominal</dt>
              <dd>
                {invoice.amount
                  ? formatMoney(new Decimal(invoice.amount).minus(requestTotal(request)))
                  : 'Belum tersedia'}
              </dd>
            </div>
          </dl>
          <p className={styles.hint}>
            Diperbarui{' '}
            {new Intl.DateTimeFormat('id-ID', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Jakarta',
            }).format(new Date(invoice.updatedAt))}{' '}
            WIB
          </p>
          <p className={styles.hint}>
            Diunggah oleh {user?.id === invoice.updatedBy ? user.name : 'Admin STAS-RG'}.
          </p>
          {invoice.file && (
            <p>
              {invoice.file.name} ·{' '}
              {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(
                invoice.file.size / 1024,
              )}{' '}
              KB
            </p>
          )}
          {preview.fileId === invoice.file?.id && preview.error && (
            <p role="alert" className={styles.formError}>
              {preview.error}
            </p>
          )}
          {invoice.file && preview.fileId === invoice.file.id && preview.blob && (
            <FilePreview key={invoice.file.id} blob={preview.blob} name={invoice.file.name} />
          )}
          {invoice.url && (
            <p>
              <a className={styles.textLink} href={invoice.url} target="_blank" rel="noreferrer">
                Buka tautan invoice
              </a>
            </p>
          )}
        </>
      )}
      {!invoice && <p className={styles.dialogDescription}>Belum ada invoice untuk request ini.</p>}
      {!allowed && !invoice && (
        <p className={styles.hint}>Admin dapat melengkapi invoice setelah request disetujui.</p>
      )}
      {allowed && !editing && (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            resetSaved();
            setExpected(invoice?.updatedAt ?? null);
            setConfirmed(false);
            setEditing(true);
          }}
        >
          Ganti invoice
        </button>
      )}
      {allowed && editing && (
        <form
          noValidate
          autoComplete="off"
          className={styles.documentForm}
          onSubmit={(event) => void submit(event)}
        >
          <FieldGroup>
            <Field
              id="invoice-number"
              label="No. invoice"
              error={errors.number?.message}
              hint="Salin nomor yang tertera pada dokumen invoice."
            >
              <input
                {...register('number')}
                {...fieldAttributes('invoice-number', errors.number?.message)}
                maxLength={120}
                spellCheck={false}
                placeholder="Contoh: INV/2026/001…"
                disabled={busy}
                required
              />
            </Field>
            <div className={styles.formGrid}>
              <Field id="invoice-amount" label="Total invoice (Rp)" error={errors.amount?.message}>
                <input
                  {...register('amount')}
                  {...fieldAttributes('invoice-amount', errors.amount?.message)}
                  inputMode="decimal"
                  placeholder="Contoh: 1250000"
                  disabled={busy}
                  required
                />
              </Field>
              <Field id="invoice-date" label="Tanggal invoice" error={errors.invoiceDate?.message}>
                <input
                  {...register('invoiceDate')}
                  {...fieldAttributes('invoice-date', errors.invoiceDate?.message)}
                  type="date"
                  disabled={busy}
                  required
                />
              </Field>
            </div>
            <Field
              id="invoice-file"
              label={invoice ? 'File pengganti (opsional)' : 'File invoice'}
              hint="PDF, PNG, JPEG, atau WebP. Maksimal 10 MB."
            >
              <input
                id="invoice-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                disabled={busy}
                onInput={(event) => setFile(event.currentTarget.files?.[0])}
              />
            </Field>
            <Field id="invoice-url" label="Tautan invoice (opsional)" error={errors.url?.message}>
              <input
                type="url"
                {...register('url')}
                {...fieldAttributes('invoice-url', errors.url?.message)}
                placeholder="https://contoh.id/invoice"
                disabled={busy}
              />
            </Field>
            {invoice && (
              <label className={styles.checkLabel} htmlFor="invoice-replace">
                <input
                  id="invoice-replace"
                  type="checkbox"
                  defaultChecked={false}
                  disabled={busy}
                  onInput={(event) => setConfirmed(event.currentTarget.checked)}
                />
                Saya mengonfirmasi perubahan invoice aktif.
              </label>
            )}
            {error && (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            )}
            <div className={styles.dialogActions}>
              {invoice && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={busy || (!!invoice && !changed)}
              >
                {busy ? 'Menyimpan…' : 'Simpan invoice'}
              </button>
            </div>
          </FieldGroup>
        </form>
      )}
      {guard}
    </section>
  );
}
export function InvoiceCell({ request }: { request: DemoRequest }) {
  const { user } = useDemo();
  const { link } = useRecordNavigation();
  const to = link(`/requests/${request.id}/invoice`);
  return request.invoice ? (
    <div className={styles.invoiceCell}>
      <Link
        className={styles.textLink}
        aria-label={`Lihat invoice ${request.item}`}
        to={to}
        onClick={rememberScroll}
      >
        Lihat invoice
      </Link>
      {request.invoice.url && (
        <a className={styles.textLink} href={request.invoice.url} target="_blank" rel="noreferrer">
          Tautan invoice
        </a>
      )}
    </div>
  ) : user?.role === 'admin' ? (
    canManageInvoice(request.status) ? (
      <Link
        className={styles.invoiceUpload}
        aria-label={`Unggah invoice ${request.item}`}
        to={to}
        onClick={rememberScroll}
      >
        Unggah invoice
      </Link>
    ) : (
      <button
        className={styles.invoiceUpload}
        type="button"
        disabled
        title="Invoice tersedia setelah request disetujui"
        aria-label={`Unggah invoice ${request.item}`}
      >
        Unggah invoice
      </button>
    )
  ) : (
    <span className={styles.hint}>Belum ada</span>
  );
}
