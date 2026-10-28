import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FieldGroup } from '@/components/ui/field';
import { useDemo } from '../demo/use-demo';
import {
  proposeReplacement,
  respondReplacement,
  replacementBlocked,
  scopedRequests,
} from '../demo/store';
import {
  replacementInputSchema,
  formatMoney,
  formatDate,
  requestTotal,
  statusLabelMap,
} from '../demo/model';
import type { DemoRequest, ReplacementInput } from '../demo/model';
import { RecordCard, RecordPage, UnavailablePage } from './record-page';
import { useRecordNavigation, useUnsavedChanges, recordDestination } from './record-navigation';
import { Field } from './shared';
import { fieldAttributes } from './form-utils';
import styles from './dashboard.module.css';

export function ReplacementBranch({
  request,
  allowActions = true,
}: {
  request: DemoRequest;
  allowActions?: boolean;
}) {
  const { user } = useDemo();
  const { link } = useRecordNavigation('/requests');
  const latest = request.replacements.at(-1);
  const eligible = ['approved', 'ordered'].includes(request.status);
  const blocked = replacementBlocked(request);
  return (
    <>
      {latest ? (
        <section
          className={styles.replacementBranch}
          aria-label="Penawaran pengganti"
          data-pending={blocked}
          data-origin={latest.originStatus}
        >
          <span className={styles.hint}>
            Cabang dari tahap {statusLabelMap.get(latest.originStatus)}
          </span>
          <h3>Penawaran pengganti</h3>
          {latest.status !== 'accepted' && (
            <ol className={styles.branchSteps}>
              <li>Link baru dari penjual</li>
              <li {...(latest.status === 'pending' ? { 'aria-current': 'step' as const } : {})}>
                {latest.status === 'pending'
                  ? 'Menunggu tinjauan Pengaju'
                  : latest.status === 'rejected'
                    ? 'Alternatif lain diperlukan'
                    : 'Disetujui Pengaju'}
              </li>
              <li>{blocked ? 'Pembelian dijeda' : 'Kembali ke proses pembelian'}</li>
            </ol>
          )}
          <p>
            {latest.status === 'pending'
              ? 'Pengaju perlu memeriksa tautan dan harga pengganti. Admin belum dapat melanjutkan tahap pembelian.'
              : latest.status === 'rejected'
                ? 'Admin perlu mengirim alternatif baru sesuai alasan Pengaju. Tahap pembelian belum dapat dilanjutkan.'
                : 'Penawaran sudah diterapkan. Admin dapat melanjutkan tahap pembelian secara manual.'}
          </p>
          {latest.status === 'rejected' && <p>Alasan Pengaju: {latest.response}</p>}
          {allowActions && (
            <Link
              className={styles.secondaryButton}
              to={link(`/requests/${request.id}/replacement`)}
            >
              {latest.status === 'pending' && user?.role === 'pengaju'
                ? 'Tinjau penawaran'
                : latest.status === 'rejected' && user?.role === 'admin'
                  ? 'Ajukan alternatif lain'
                  : 'Lihat penawaran'}
            </Link>
          )}
        </section>
      ) : (
        eligible && (
          <p className={styles.hint}>
            Biasanya pembelian dilanjutkan ke tahap berikutnya. Jika penjual memberikan link barang
            pengganti, Admin mengirim penawaran untuk ditinjau Pengaju.
          </p>
        )
      )}
      {allowActions && eligible && user?.role === 'admin' && !blocked && (
        <Link className={styles.secondaryButton} to={link(`/requests/${request.id}/replacement`)}>
          Ajukan link pengganti
        </Link>
      )}
      {request.replacements.length > 0 && (
        <details className={styles.history}>
          <summary>Riwayat penawaran pengganti ({request.replacements.length})</summary>
          <ol>
            {request.replacements.toReversed().map((proposal) => (
              <li key={proposal.id}>
                <strong>
                  {proposal.status === 'pending'
                    ? 'Menunggu tinjauan'
                    : proposal.status === 'accepted'
                      ? 'Disetujui Pengaju'
                      : 'Meminta alternatif lain'}{' '}
                  · {formatDate(proposal.createdAt)}
                </strong>
                <a className={styles.textLink} href={proposal.url} target="_blank" rel="noreferrer">
                  Buka penawaran pengganti
                </a>
                <span>
                  {formatMoney(proposal.previousUnitPrice)} menjadi{' '}
                  {formatMoney(proposal.unitPrice)} per {request.unit}
                </span>
                <p>{proposal.reason}</p>
                {proposal.response && <p>Tanggapan: {proposal.response}</p>}
                {proposal.respondedAt && <span>Ditanggapi {formatDate(proposal.respondedAt)}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}

export function ReplacementPage() {
  const { data, user } = useDemo();
  const { requestId } = useParams();
  const { back } = useRecordNavigation('/requests');
  const request = user ? scopedRequests(data, user).find((row) => row.id === requestId) : undefined;
  if (!request || !user) return <UnavailablePage back={back} />;
  return <ReplacementEditor key={request.id} request={request} />;
}

function ReplacementEditor({ request }: { request: DemoRequest }) {
  const { user } = useDemo();
  const { back } = useRecordNavigation(`/requests/${request.id}`);
  const navigate = useNavigate();
  const [revision] = useState(request.revision);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const responseError = error.startsWith('Jelaskan alasan') ? error : undefined;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ReplacementInput>({
    resolver: zodResolver(replacementInputSchema),
    defaultValues: { url: request.url, unitPrice: request.unitPrice, reason: '' },
  });
  const proposedPrice = useWatch({ control, name: 'unitPrice' });
  const validPrice = replacementInputSchema.shape.unitPrice.safeParse(proposedPrice).success;
  const latest = request.replacements.at(-1);
  const eligible = ['approved', 'ordered'].includes(request.status);
  const mayPropose = user?.role === 'admin' && eligible && latest?.status !== 'pending';
  const mayRespond = user?.role === 'pengaju' && latest?.status === 'pending' && eligible;
  const { guard, markSaved } = useUnsavedChanges(
    (mayPropose && isDirty) || (mayRespond && !!response),
    isSubmitting,
  );
  function saved(message: string) {
    markSaved();
    toast.success(message);
    void navigate(recordDestination(`/requests/${request.id}`, back), {
      replace: true,
    });
  }
  const submit = handleSubmit((values) => {
    setError('');
    try {
      proposeReplacement(request.id, revision, values);
      saved('Penawaran dikirim untuk ditinjau Pengaju.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Penawaran gagal disimpan. Coba lagi.');
    }
  });
  function respond(decision: 'accepted' | 'rejected') {
    if (!latest) return;
    setError('');
    if (decision === 'rejected' && !response.trim()) {
      setError('Jelaskan alasan meminta alternatif lain.');
      document.getElementById('replacement-response')?.focus();
      return;
    }
    try {
      respondReplacement(request.id, revision, latest.id, decision, response);
      saved(
        decision === 'accepted'
          ? 'Penawaran disetujui. Admin dapat melanjutkan pembelian.'
          : 'Permintaan alternatif dikirim kepada Admin.',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tanggapan gagal disimpan. Coba lagi.');
    }
  }
  return (
    <RecordPage
      title="Penawaran pengganti"
      back={back}
      aside={
        <RecordCard title="Barang tetap">
          <p>{request.item}</p>
          <p>
            {request.quantity} {request.unit}
          </p>
          <p>Nilai saat ini: {formatMoney(requestTotal(request))}</p>
          <p className={styles.hint}>
            Nama, jumlah, dan satuan tetap. Tautan dan harga baru diterapkan setelah Pengaju
            menyetujui.
          </p>
        </RecordCard>
      }
    >
      <RecordCard
        title={mayPropose ? 'Ajukan link pengganti' : 'Periksa penawaran'}
        description="Bandingkan tautan dan harga sebelum melanjutkan pembelian."
      >
        {mayPropose ? (
          <form noValidate autoComplete="off" onSubmit={(event) => void submit(event)}>
            <FieldGroup>
              <p>
                Tautan sebelumnya:{' '}
                {request.url ? (
                  <a
                    className={styles.textLink}
                    href={request.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka tautan sebelumnya
                  </a>
                ) : (
                  'Belum ada tautan'
                )}
              </p>
              <p>
                Harga sebelumnya: {formatMoney(request.unitPrice)} per {request.unit}
              </p>
              <Field id="replacement-url" label="Tautan pengganti" error={errors.url?.message}>
                <input
                  {...register('url')}
                  {...fieldAttributes('replacement-url', errors.url?.message)}
                  type="url"
                  required
                />
              </Field>
              <Field
                id="replacement-price"
                label="Harga satuan pengganti (Rp)"
                error={errors.unitPrice?.message}
              >
                <input
                  {...register('unitPrice')}
                  {...fieldAttributes('replacement-price', errors.unitPrice?.message)}
                  inputMode="decimal"
                  required
                />
              </Field>
              <p aria-live="polite">
                Total pengganti:{' '}
                {validPrice
                  ? formatMoney(
                      requestTotal({ unitPrice: proposedPrice, quantity: request.quantity }),
                    )
                  : 'Lengkapi harga yang valid'}
              </p>
              <Field
                id="replacement-reason"
                label="Alasan penggantian"
                error={errors.reason?.message}
              >
                <textarea
                  {...register('reason')}
                  {...fieldAttributes('replacement-reason', errors.reason?.message)}
                  maxLength={2000}
                  required
                />
              </Field>
              {error && (
                <p role="alert" className={styles.formError}>
                  {error}
                </p>
              )}
              <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                Kirim untuk ditinjau Pengaju
              </button>
            </FieldGroup>
          </form>
        ) : latest ? (
          <>
            <dl className={styles.detailGrid}>
              <div>
                <dt>Harga sebelumnya</dt>
                <dd>{formatMoney(latest.previousUnitPrice)}</dd>
              </div>
              <div>
                <dt>Harga pengganti</dt>
                <dd>{formatMoney(latest.unitPrice)}</dd>
              </div>
              <div>
                <dt>Total pengganti</dt>
                <dd>
                  {formatMoney(
                    requestTotal({ unitPrice: latest.unitPrice, quantity: request.quantity }),
                  )}
                </dd>
              </div>
            </dl>
            {latest.previousUrl && (
              <p>
                <a
                  className={styles.textLink}
                  href={latest.previousUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka tautan sebelumnya
                </a>
              </p>
            )}
            <p>
              <a className={styles.textLink} href={latest.url} target="_blank" rel="noreferrer">
                Buka tautan pengganti
              </a>
            </p>
            <p>Alasan Admin: {latest.reason}</p>
            {mayRespond && (
              <FieldGroup>
                <Field
                  id="replacement-response"
                  label="Alasan meminta alternatif lain (wajib jika tidak setuju)"
                  error={responseError}
                >
                  <textarea
                    {...fieldAttributes('replacement-response', responseError)}
                    value={response}
                    maxLength={2000}
                    onInput={(event) => setResponse(event.currentTarget.value)}
                  />
                </Field>
                {error && !responseError && (
                  <p role="alert" className={styles.formError}>
                    {error}
                  </p>
                )}
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => respond('rejected')}
                  >
                    Minta alternatif lain
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => respond('accepted')}
                  >
                    Setujui penawaran
                  </button>
                </div>
              </FieldGroup>
            )}
          </>
        ) : (
          <p>Belum ada penawaran pengganti untuk barang ini.</p>
        )}
        {!eligible && (
          <p className={styles.hint}>
            Penawaran baru tersedia pada tahap Disetujui atau Sudah Dipesan.
          </p>
        )}
      </RecordCard>
      <RecordCard title="Posisi proses">
        <ReplacementBranch request={request} allowActions={false} />
      </RecordCard>
      {guard}
    </RecordPage>
  );
}
