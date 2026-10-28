import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRightStartOnRectangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { useDemo } from '../demo/use-demo';
import {
  canManageInvoice,
  markNotificationsRead,
  scopedRequests,
  replacementBlocked,
  visibleRab,
} from '../demo/store';
import { formatDate, formatMoney, requestTotal, statusLabelMap, researchUsed } from '../demo/model';
import type { DemoRequest } from '../demo/model';
import { allowedNextStatuses } from '../demo/request-workflow';
import { useDemoLogout } from '../auth/use-demo-logout';
import { RequestEditor, ResearchEditor, UserEditor } from './editors';
import { RequestStatusEditor } from './request-status-editor';
import { InvoiceContent } from './invoice';
import { ReplacementBranch } from './replacement';
import { SubmissionStatusCell } from './submission-status';
import { RabDetails } from './rab-list';
import { RabImporter } from './rab-import';
import { StatusBadge } from './shared';
import { RecordCard, RecordPage, UnavailablePage } from './record-page';
import { useRecordNavigation, recordDestination } from './record-navigation';
import styles from './dashboard.module.css';

function AccessDenied() {
  return (
    <RecordPage title="Akses ditolak" back="/dashboard">
      <RecordCard title="Khusus Admin">
        <p>Tindakan ini hanya tersedia untuk Admin.</p>
      </RecordCard>
    </RecordPage>
  );
}
export function RequestTimeline({ request }: { request: DemoRequest }) {
  const stages = [
    'pending_review',
    'approved',
    'ordered',
    'in_transit',
    'delivered',
    'completed',
  ] as const;
  const current = stages.findIndex((stage) => stage === request.status);
  const replacement = request.replacements.at(-1);
  const terminal = request.status === 'rejected' || request.status === 'cancelled';
  const { data } = useDemo();
  return (
    <RecordCard
      title="Proses pembelian"
      description="Tahapan diperbarui oleh Admin. Tanggal mengikuti riwayat yang tercatat."
    >
      <ol className={styles.fulfillmentTimeline}>
        {stages.map((stage, index) => {
          const history = request.statusHistory.find((change) => change.to === stage);
          const at = stage === 'pending_review' ? request.createdAt : history?.at;
          const reached = terminal ? index === 0 : index <= current;
          return (
            <Fragment key={stage}>
              <li
                style={{ '--stage-column': index + 1 } as CSSProperties}
                data-reached={reached}
                {...(stage === request.status ? { 'aria-current': 'step' as const } : {})}
              >
                <span className={styles.stageNumber} aria-hidden="true">
                  {reached && stage !== request.status ? (
                    <CheckIcon aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <strong>{statusLabelMap.get(stage)}</strong>
                <span>
                  {reached ? (at ? formatDate(at) : 'Tanggal belum tercatat') : 'Belum berlangsung'}
                </span>
              </li>
              {replacement?.originStatus === stage && (
                <li
                  className={styles.timelineBranch}
                  style={{ '--stage-column': index + 1 } as CSSProperties}
                >
                  <ReplacementBranch request={request} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      {!replacement && <ReplacementBranch request={request} />}
      {terminal && (
        <p className={styles.terminalNotice}>
          <StatusBadge status={request.status} />{' '}
          {request.statusHistory.at(-1)?.reason || 'Proses pembelian berakhir.'}
        </p>
      )}
      <details className={styles.history}>
        <summary>Riwayat perubahan</summary>
        {request.statusHistory.length ? (
          <ol>
            {request.statusHistory.toReversed().map((change, index) => (
              <li key={`${change.at}-${index}`}>
                <strong>
                  {statusLabelMap.get(change.from)} → {statusLabelMap.get(change.to)}
                </strong>
                <span>
                  {data.users.find((actor) => actor.id === change.actorId)?.name ?? 'Admin'} ·{' '}
                  {new Intl.DateTimeFormat('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Jakarta',
                  }).format(new Date(change.at))}{' '}
                  WIB
                </span>
                {change.reason && <p>{change.reason}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.hint}>Belum ada perubahan status yang tercatat.</p>
        )}
      </details>
    </RecordCard>
  );
}
export function RequestRecordPage({
  mode = 'view',
}: {
  mode?: 'view' | 'new' | 'edit' | 'status' | 'invoice';
}) {
  const { data, user } = useDemo();
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { back, link } = useRecordNavigation('/requests');
  const request = user ? scopedRequests(data, user).find((row) => row.id === requestId) : undefined;
  const saved = (id: string) => {
    void navigate(recordDestination(`/requests/${encodeURIComponent(id)}`, back), {
      replace: true,
    });
  };
  if (!user) return null;
  if (mode === 'new')
    return user.role === 'pengaju' ? (
      <RequestEditor onClose={() => void navigate(back)} onSaved={saved} />
    ) : (
      <AccessDenied />
    );
  if (!request) return <UnavailablePage back={back} />;
  if (['edit', 'status'].includes(mode) && user.role !== 'admin') return <AccessDenied />;
  if (mode === 'edit' && replacementBlocked(request))
    return (
      <RecordPage title="Pembelian dijeda" back={back}>
        <RecordCard title="Tuntaskan penawaran pengganti">
          <ReplacementBranch request={request} />
        </RecordCard>
      </RecordPage>
    );
  if (mode === 'edit')
    return <RequestEditor request={request} onClose={() => void navigate(back)} onSaved={saved} />;
  if (mode === 'invoice')
    return (
      <RecordPage
        title="Invoice Pembelian Barang"
        back={back}
        aside={
          <RecordCard title="Nilai request">
            <p className={styles.pageTotal}>{formatMoney(requestTotal(request))}</p>
            <p>{request.item}</p>
            <p className={styles.hint}>
              Nominal invoice tidak mengubah nilai request atau alokasi riset.
            </p>
          </RecordCard>
        }
      >
        <RecordCard title="Dokumen dan informasi invoice">
          <InvoiceContent request={request} />
        </RecordCard>
      </RecordPage>
    );
  if (mode === 'status')
    return (
      <RecordPage
        title="Ubah status pembelian"
        back={back}
        aside={
          <RecordCard title={request.item}>
            <StatusBadge status={request.status} />
            <p>{formatMoney(requestTotal(request))}</p>
            <p className={styles.hint}>
              Perubahan status dicatat dan diberitahukan kepada Pengaju.
            </p>
          </RecordCard>
        }
      >
        <RecordCard title="Tahap berikutnya">
          <RequestStatusEditor
            request={request}
            onClose={() => void navigate(back)}
            onSaved={() => saved(request.id)}
          />
        </RecordCard>
      </RecordPage>
    );
  const owner = data.users.find((person) => person.id === request.ownerId);
  const research = data.research.find((item) => item.id === request.researchId);
  return (
    <RecordPage
      title={request.item}
      back={back}
      actions={
        user.role === 'admin' && (
          <Link className={styles.secondaryButton} to={link(`/requests/${request.id}/edit`)}>
            Edit barang
          </Link>
        )
      }
      aside={
        <>
          <RecordCard title="Ringkasan pembelian">
            <StatusBadge status={request.status} />
            <dl className={styles.summaryValues}>
              <div>
                <dt>Jumlah</dt>
                <dd>
                  {request.quantity} {request.unit}
                </dd>
              </div>
              <div>
                <dt>Harga satuan</dt>
                <dd>{formatMoney(request.unitPrice)}</dd>
              </div>
              <div>
                <dt>Total request</dt>
                <dd className={styles.pageTotal}>{formatMoney(requestTotal(request))}</dd>
              </div>
            </dl>
            {user.role === 'admin' &&
              !replacementBlocked(request) &&
              allowedNextStatuses(request.status).length > 0 && (
                <Link className={styles.primaryButton} to={link(`/requests/${request.id}/status`)}>
                  Ubah status
                </Link>
              )}
          </RecordCard>
          <RecordCard title="Invoice">
            <p className={styles.invoiceNumber}>
              {request.invoice?.number ??
                (request.invoice ? 'Nomor belum dilengkapi' : 'Belum ada invoice')}
            </p>
            <p>
              {request.invoice?.amount
                ? formatMoney(request.invoice.amount)
                : 'Nominal belum dilengkapi'}
            </p>
            <p className={styles.hint}>
              {request.invoice?.invoiceDate
                ? formatDate(request.invoice.invoiceDate)
                : 'Tanggal belum dilengkapi'}
            </p>
            <Link className={styles.secondaryButton} to={link(`/requests/${request.id}/invoice`)}>
              {request.invoice
                ? 'Lihat invoice'
                : user.role === 'admin' && canManageInvoice(request.status)
                  ? 'Unggah invoice'
                  : 'Informasi invoice'}
            </Link>
          </RecordCard>
          {request.rabDocumentId && (
            <RecordCard title="RAB sumber">
              <p className={styles.hint}>Versi sumber tetap mengikuti saat barang diajukan.</p>
              <Link className={styles.textLink} to={link(`/requests/rab/${request.rabDocumentId}`)}>
                Lihat barang RAB
              </Link>
            </RecordCard>
          )}
        </>
      }
    >
      <RecordCard title="Informasi barang">
        <dl className={styles.detailGrid}>
          {[
            ['Pengaju', owner?.name],
            ['Riset', research?.name],
            ['Tanggal diajukan', formatDate(request.createdAt)],
            ['Tanggal kebutuhan', formatDate(request.requiredDate)],
            ['Catatan', request.notes || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div>
            <dt>Status pengajuan</dt>
            <dd>
              <SubmissionStatusCell request={request} />
            </dd>
          </div>
        </dl>
        <p className={styles.hint}>
          Status pengajuan dicatat Admin, terpisah dari tahapan pembelian barang.
        </p>
        {request.url && (
          <a className={styles.textLink} href={request.url} target="_blank" rel="noreferrer">
            Buka tautan barang
          </a>
        )}
      </RecordCard>
      <RequestTimeline request={request} />
    </RecordPage>
  );
}

export function UserRecordPage({ mode = 'view' }: { mode?: 'view' | 'new' | 'edit' }) {
  const { data } = useDemo();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { back, link } = useRecordNavigation('/users');
  const record = data.users.find((person) => person.id === userId);
  const saved = (id: string) =>
    void navigate(recordDestination(`/users/${id}`, back), { replace: true });
  if (mode !== 'new' && !record)
    return <UnavailablePage title="Pengguna tidak tersedia" back={back} />;
  if (mode !== 'view')
    return <UserEditor user={record} onClose={() => void navigate(back)} onSaved={saved} />;
  if (!record) return null;
  return (
    <RecordPage
      title={record.name}
      back={back}
      section="Manajemen Pengguna"
      actions={
        <Link className={styles.primaryButton} to={link(`/users/${record.id}/edit`)}>
          Edit pengguna
        </Link>
      }
      aside={
        <RecordCard title="Hak akses">
          <p>{record.role === 'admin' ? 'Admin' : 'Pengaju'}</p>
          <p className={styles.hint}>Akun tambahan merupakan data demo.</p>
        </RecordCard>
      }
    >
      <RecordCard title="Informasi pengguna">
        <dl className={styles.detailGrid}>
          {[
            ['Nama lengkap', record.name],
            ['NIP/NIM', record.identifier],
            ['Email', record.email],
            ['Tanggal dibuat', formatDate(record.createdAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </RecordCard>
      <RecordCard title="Perwakilan riset">
        <ul className={styles.assignmentList}>
          {record.researchIds.map((id) => (
            <li key={id}>{data.research.find((item) => item.id === id)?.name}</li>
          ))}
        </ul>
        {!record.researchIds.length && <p>Tidak ada perwakilan riset.</p>}
      </RecordCard>
    </RecordPage>
  );
}
export function ResearchRecordPage({ mode = 'view' }: { mode?: 'view' | 'new' | 'edit' }) {
  const { data } = useDemo();
  const { researchId } = useParams();
  const navigate = useNavigate();
  const { back, link } = useRecordNavigation('/research-types');
  const record = data.research.find((item) => item.id === researchId);
  if (mode !== 'new' && !record)
    return <UnavailablePage title="Riset tidak tersedia" back={back} />;
  if (mode !== 'view')
    return (
      <ResearchEditor
        research={record}
        onClose={() => void navigate(back)}
        onSaved={(id) =>
          void navigate(recordDestination(`/research-types/${id}`, back), {
            replace: true,
          })
        }
      />
    );
  if (!record) return null;
  const used = researchUsed(data, record.id);
  return (
    <RecordPage
      title={record.name}
      back={back}
      section="Jenis Riset"
      actions={
        <Link className={styles.primaryButton} to={link(`/research-types/${record.id}/edit`)}>
          Edit riset
        </Link>
      }
      aside={
        <RecordCard title="Dana riset">
          <dl className={styles.summaryValues}>
            {[
              ['Alokasi', record.allocated],
              ['Komitmen', used.toString()],
              ['Sisa alokasi', new Decimal(record.allocated).minus(used).toString()],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{formatMoney(value ?? '0')}</dd>
              </div>
            ))}
          </dl>
        </RecordCard>
      }
    >
      <RecordCard title="Informasi riset">
        <p>{record.description || 'Belum ada deskripsi.'}</p>
        <p className={styles.hint}>
          Komitmen mencakup request disetujui hingga selesai; bukan pembayaran invoice.
        </p>
      </RecordCard>
      <RecordCard title="Akses terkait">
        <Link className={styles.textLink} to={`/requests?research=${record.id}`}>
          Lihat pembelian riset
        </Link>
        <Link className={styles.textLink} to={`/requests/rab?rabResearch=${record.id}`}>
          Lihat RAB riset
        </Link>
      </RecordCard>
    </RecordPage>
  );
}
export function RabRecordPage({ importing = false }: { importing?: boolean }) {
  const { rabId } = useParams();
  const { user } = useDemo();
  const navigate = useNavigate();
  const { back } = useRecordNavigation('/requests/rab');
  if (importing)
    return user?.role === 'admin' ? (
      <RabImporter
        onClose={() => void navigate(back)}
        onImported={(id) =>
          void navigate(`/requests/rab/${id}?returnTo=${encodeURIComponent(back)}`, {
            replace: true,
          })
        }
      />
    ) : (
      <AccessDenied />
    );
  const doc = (() => {
    try {
      return visibleRab(rabId ?? '');
    } catch {
      return null;
    }
  })();
  return doc ? (
    <RecordPage title={doc.name} back={back} section="RAB">
      <RabDetails doc={doc} />
    </RecordPage>
  ) : (
    <UnavailablePage title="RAB tidak tersedia" back={back} />
  );
}
export function ProfilePage() {
  const { user } = useDemo();
  const { mutate: logout } = useDemoLogout();
  if (!user) return null;
  return (
    <RecordPage title="Profil Pengguna" back="/dashboard" section="Dashboard">
      <RecordCard title="Informasi akun">
        <dl className={styles.detailGrid}>
          {[
            ['Nama', user.name],
            ['Email', user.email],
            ['Peran', user.role === 'admin' ? 'Admin' : 'Pengaju'],
            ['Lingkungan', 'Mode demo · Data contoh'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className={`${styles.secondaryButton} ${styles.logoutButton}`}
          onClick={() => logout()}
        >
          <ArrowRightStartOnRectangleIcon aria-hidden="true" />
          Keluar
        </button>
      </RecordCard>
    </RecordPage>
  );
}
export function NotificationsPage() {
  const { data, user } = useDemo();
  const { link } = useRecordNavigation('/dashboard');
  const notifications = data.notifications.filter((item) => item.recipientId === user?.id);
  const unread = notifications.some((item) => !item.read);
  return (
    <RecordPage
      title="Notifikasi"
      back="/dashboard"
      section="Dashboard"
      actions={
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={!unread}
          onClick={() => {
            markNotificationsRead();
            toast.success('Semua notifikasi ditandai dibaca.');
          }}
        >
          Tandai semua dibaca
        </button>
      }
    >
      <RecordCard title="Pembaruan pembelian">
        <div className={styles.noticeList}>
          {notifications.map((item) => (
            <article key={item.id} className={styles.noticeItem} data-unread={!item.read}>
              <p>{item.message}</p>
              <span className={styles.hint}>{formatDate(item.createdAt)}</span>
              <div className={styles.noticeActions}>
                {!item.read && (
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationsRead([item.id]);
                      toast.success('Notifikasi ditandai dibaca.');
                    }}
                  >
                    Tandai dibaca
                  </button>
                )}
                <Link
                  to={link(`/requests/${item.requestId}`)}
                  onClick={() => markNotificationsRead([item.id])}
                >
                  Buka request
                </Link>
              </div>
            </article>
          ))}
          {!notifications.length && <p className={styles.empty}>Belum ada notifikasi.</p>}
        </div>
      </RecordCard>
    </RecordPage>
  );
}
