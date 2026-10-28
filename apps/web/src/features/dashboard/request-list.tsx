import { ThemedSelect } from '@/components/ui/themed-select';
import { DateRangePicker } from './date-range-picker';
import { inDateRange, readDateRange } from './date-range';
import { PartyHeader } from './party-header';
import { InvoiceCell } from './invoice';
import { SubmissionStatusCell } from './submission-status';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useDemo } from '../demo/use-demo';
import { scopedRequests, deleteRequest, cancelRequest } from '../demo/store';
import { requestTotal, formatMoney, formatDate, statusLabels, statusSchema } from '../demo/model';
import { allowedNextStatuses } from '../demo/request-workflow';
import { ConfirmDialog, Pagination, StatusBadge } from './shared';
import { ActionMenu } from './action-menu';
import { SortHeader } from './sort-header';
import { readSort, requestColumns, sortParams, sortRequests } from './table-sorting';
import { downloadRequests } from './export-requests';
import { useRecordNavigation, rememberScroll } from './record-navigation';
import styles from './dashboard.module.css';

type Action = { kind: 'delete' | 'cancel'; id: string };
const columns = [
  ['item', 'Barang'],
  ['quantity', 'Jumlah'],
  ['total', 'Total'],
  ['status', 'Status'],
  ['submissionStatus', 'Status pengajuan'],
  ['createdAt', 'Diajukan'],
  ['invoice', 'Invoice'],
  ['invoiceNumber', 'No. invoice'],
] as const;

export function RequestList({ recent = false }: { recent?: boolean }) {
  const { data, user } = useDemo();
  const [params, setParams] = useSearchParams();
  const { link } = useRecordNavigation();
  const [action, setAction] = useState<Action | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  if (!user) return null;
  const all = scopedRequests(data, user).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const base = recent ? all.slice(0, 5) : all;
  const query = recent ? '' : (params.get('q') ?? '');
  const status =
    !recent && statusSchema.safeParse(params.get('status')).success
      ? (params.get('status') ?? '')
      : '';
  const research =
    !recent && data.research.some((item) => item.id === params.get('research'))
      ? (params.get('research') ?? '')
      : '';
  const sort = readSort(params, requestColumns, 'createdAt', 'desc', true);
  const range = recent ? null : readDateRange(params);
  const filtered = sortRequests(
    base.filter((request) => {
      const owner = data.users.find((item) => item.id === request.ownerId)?.name ?? '';
      const researchName = data.research.find((item) => item.id === request.researchId)?.name ?? '';
      return (
        inDateRange(request.createdAt, range) &&
        (!status || request.status === status) &&
        (!research || request.researchId === research) &&
        `${request.item} ${owner} ${researchName}`
          .toLocaleLowerCase('id')
          .includes(query.toLocaleLowerCase('id').trim())
      );
    }),
    data,
    sort.key,
    sort.direction,
  );
  const pageSizeValue = Number(params.get('size'));
  const pageSize = [5, 10, 20].includes(pageSizeValue) ? pageSizeValue : 5;
  const pageValue = Number(params.get('page'));
  const page = Math.max(
    1,
    Math.min(
      Number.isInteger(pageValue) ? pageValue : 1,
      Math.max(1, Math.ceil(filtered.length / pageSize)),
    ),
  );
  const rows = recent ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }
  function close() {
    setAction(null);
    const next = new URLSearchParams(params);
    next.delete('detail');
    next.delete('create');
    next.delete('sourceRab');
    next.delete('sourceItem');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }
  function choose(next: Action) {
    setAction(next);
  }
  const activeAction = action;
  const selected = action && 'id' in action ? all.find((item) => item.id === action.id) : undefined;
  async function exportRows() {
    setExporting(true);
    setExportError('');
    try {
      await downloadRequests(filtered, data, { range, filters: params.toString() });
      toast.success('Daftar request berhasil diekspor.');
    } catch {
      setExportError('Ekspor gagal. Silakan coba lagi.');
      toast.error('Ekspor gagal. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <section aria-label={recent ? 'Pembelian Barang Terbaru' : 'Daftar Pembelian Barang'}>
      {recent && (
        <div className={styles.sectionRow}>
          <div>
            <h2>Request terbaru</h2>
            <p>Lima pengajuan terakhir dalam lingkup Anda.</p>
          </div>
          <Link className={styles.textLink} to="/requests">
            Lihat semua request <ArrowRightIcon aria-hidden="true" />
          </Link>
        </div>
      )}
      <div className={styles.dataPanel}>
        {!recent && (
          <div className={styles.filters}>
            <div className={styles.search}>
              <MagnifyingGlassIcon aria-hidden="true" />
              <input
                aria-label="Cari request"
                type="search"
                placeholder="Cari barang, pengaju, atau riset…"
                value={query}
                onInput={(event) => update('q', event.currentTarget.value)}
              />
            </div>
            <div className={styles.selectWrap}>
              <ThemedSelect
                label="Filter status"
                value={status}
                onValueChange={(value) => update('status', value)}
                options={[
                  { value: '', label: 'Semua status' },
                  ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
                ]}
              />
            </div>
            <div className={styles.selectWrap}>
              <ThemedSelect
                label="Filter jenis riset"
                value={research}
                onValueChange={(value) => update('research', value)}
                options={[
                  { value: '', label: 'Semua riset' },
                  ...data.research
                    .filter((item) => user.role === 'admin' || user.researchIds.includes(item.id))
                    .map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </div>
            <DateRangePicker
              value={range}
              onValueChange={(value) => {
                const next = new URLSearchParams(params);
                next.delete('page');
                if (value) {
                  next.set('from', value.from);
                  next.set('to', value.to);
                } else {
                  next.delete('from');
                  next.delete('to');
                }
                setParams(next, { replace: true });
              }}
            />
            {user.role === 'admin' ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={exporting || filtered.length === 0}
                aria-busy={exporting}
                onClick={() => void exportRows()}
              >
                <ArrowDownTrayIcon aria-hidden="true" />
                {exporting ? 'Mengekspor…' : 'Ekspor Excel'}
              </button>
            ) : (
              <Link
                className={styles.primaryButton}
                to={link('/requests/new')}
                onClick={rememberScroll}
              >
                <PlusIcon aria-hidden="true" />
                Buat request
              </Link>
            )}
            {exportError && (
              <p className={styles.formError} role="alert">
                {exportError}
              </p>
            )}
          </div>
        )}
        {user.role === 'admin' && (
          <p className={styles.tableHint}>Klik status pengajuan untuk mengubahnya.</p>
        )}
        <div
          className={styles.tableWrap}
          tabIndex={0}
          role="region"
          aria-label="Tabel Pembelian Barang"
        >
          <table className={styles.table}>
            <caption className="sr-only">
              {recent ? 'Lima request terbaru' : 'Daftar request'} sesuai hak akses pengguna
            </caption>
            <thead>
              <tr>
                <SortHeader
                  label="Barang"
                  active={sort.key === 'item'}
                  direction={sort.direction}
                  onSort={() =>
                    setParams(sortParams(params, 'item', sort.key, sort.direction), {
                      replace: true,
                    })
                  }
                />
                <PartyHeader
                  active={sort.key}
                  direction={sort.direction}
                  onSort={(key, direction) => {
                    const next = new URLSearchParams(params);
                    next.set('sortBy', key);
                    next.set('sortDir', direction);
                    next.delete('sort');
                    next.delete('page');
                    setParams(next, { replace: true });
                  }}
                />
                {columns
                  .filter(([key]) => key !== 'item')
                  .map(([key, label]) => (
                    <SortHeader
                      key={key}
                      label={label}
                      active={sort.key === key}
                      direction={sort.direction}
                      numeric={key === 'quantity' || key === 'total'}
                      onSort={() =>
                        setParams(sortParams(params, key, sort.key, sort.direction), {
                          replace: true,
                        })
                      }
                    />
                  ))}
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <tr key={request.id}>
                  <td className={styles.itemCell}>{request.item}</td>
                  <td>
                    <div className={styles.partyCell}>
                      <span>{data.users.find((owner) => owner.id === request.ownerId)?.name}</span>
                      <small>
                        {data.research.find((item) => item.id === request.researchId)?.name}
                      </small>
                    </div>
                  </td>
                  <td className={styles.money}>
                    {request.quantity} {request.unit}
                  </td>
                  <td className={styles.money}>{formatMoney(requestTotal(request))}</td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>
                    <SubmissionStatusCell request={request} />
                  </td>
                  <td className={styles.dateCell}>{formatDate(request.createdAt)}</td>
                  <td>
                    <InvoiceCell request={request} />
                  </td>
                  <td className={styles.invoiceNumber}>
                    {request.invoice?.number ??
                      (request.invoice ? 'Belum dilengkapi' : 'Belum ada')}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.iconButton}
                        aria-label={`Lihat ${request.item}`}
                        title="Lihat detail"
                        to={link(`/requests/${request.id}`)}
                        onClick={rememberScroll}
                      >
                        <EyeIcon aria-hidden="true" />
                      </Link>
                      <ActionMenu
                        label={`Aksi ${request.item}`}
                        items={
                          user.role === 'admin'
                            ? [
                                {
                                  label: 'Ubah status',
                                  to: link(`/requests/${request.id}/status`),
                                  disabled: !allowedNextStatuses(request.status).length,
                                  hint: 'Status akhir tidak dapat diubah',
                                },
                                {
                                  label: `Edit ${request.item}`,
                                  to: link(`/requests/${request.id}/edit`),
                                },
                                {
                                  label: `Hapus ${request.item}`,
                                  danger: true,
                                  onSelect: () => choose({ kind: 'delete', id: request.id }),
                                },
                              ]
                            : [
                                {
                                  label: `Batalkan ${request.item}`,
                                  danger: true,
                                  disabled: request.status !== 'pending_review',
                                  hint: 'Hanya request menunggu persetujuan yang dapat dibatalkan',
                                  onSelect: () => choose({ kind: 'cancel', id: request.id }),
                                },
                              ]
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className={styles.empty}>
              <strong>Tidak ada request yang sesuai.</strong>
              <p>Coba ubah pencarian atau filter untuk melihat pengajuan lain.</p>
            </div>
          )}
        </div>
        {recent ? (
          <p className={styles.resultCount} aria-live="polite">
            Menampilkan {rows.length} request terbaru
          </p>
        ) : (
          <Pagination
            count={filtered.length}
            page={page}
            pageSize={pageSize}
            onPage={(value) => update('page', String(value))}
            onPageSize={(value) => update('size', String(value))}
          />
        )}
      </div>
      {activeAction?.kind === 'delete' && selected && user.role === 'admin' && (
        <ConfirmDialog
          title="Hapus Request"
          description={`Hapus ${selected.item} dari daftar? Data contoh ini akan diarsipkan.`}
          confirmLabel="Hapus Request"
          onConfirm={() => {
            deleteRequest(selected.id, selected.revision);
            toast.success('Request berhasil dihapus.');
          }}
          onClose={close}
        />
      )}
      {activeAction?.kind === 'cancel' && selected && user.role === 'pengaju' && (
        <ConfirmDialog
          title="Batalkan Request"
          description={`Batalkan pengajuan ${selected.item}? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Batalkan Request"
          onConfirm={() => {
            cancelRequest(selected.id, selected.revision);
            toast.success('Request berhasil dibatalkan.');
          }}
          onClose={close}
        />
      )}
    </section>
  );
}
