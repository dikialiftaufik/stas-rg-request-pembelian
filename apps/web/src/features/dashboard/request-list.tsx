import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  ArrowDownTrayIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useDemo } from '../demo/use-demo';
import { scopedRequests, deleteRequest, cancelRequest } from '../demo/store';
import { requestTotal, formatMoney, formatDate, statusLabels, statusSchema } from '../demo/model';
import type { DemoRequest } from '../demo/model';
import { ConfirmDialog, Modal, Pagination, StatusBadge } from './shared';
import { RequestEditor } from './editors';
import { downloadRequests } from './export-requests';
import styles from './dashboard.module.css';

export function RequestDetails({
  request,
  onClose,
}: {
  request: DemoRequest;
  onClose: () => void;
}) {
  const { data } = useDemo();
  const fields = [
    ['Barang', request.item],
    ['Pengaju', data.users.find((user) => user.id === request.ownerId)?.name ?? ''],
    ['Jenis riset', data.research.find((item) => item.id === request.researchId)?.name ?? ''],
    ['Jumlah', `${request.quantity} unit`],
    ['Harga satuan', formatMoney(request.unitPrice)],
    ['Total', formatMoney(requestTotal(request))],
    ['Tanggal kebutuhan', formatDate(request.requiredDate)],
    ['Tanggal diajukan', formatDate(request.createdAt)],
    ['Catatan', request.notes || '—'],
  ];
  return (
    <Modal title="Detail Request Pembelian" onClose={onClose} wide>
      <dl className={styles.detailGrid}>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={request.status} />
          </dd>
        </div>
        {request.url && (
          <div>
            <dt>URL barang</dt>
            <dd>
              <a href={request.url} target="_blank" rel="noopener noreferrer">
                Buka tautan barang
              </a>
            </dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}

type Action = { kind: 'view' | 'edit' | 'delete' | 'cancel'; id: string } | { kind: 'create' };

export function RequestList({ recent = false }: { recent?: boolean }) {
  const { data, user } = useDemo();
  const [params, setParams] = useSearchParams();
  const [action, setAction] = useState<Action | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  if (!user) return null;
  const all = scopedRequests(data, user).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const base = recent ? all.slice(0, 5) : all;
  const query = params.get('q') ?? '';
  const status = statusSchema.safeParse(params.get('status')).success
    ? (params.get('status') ?? '')
    : '';
  const research = data.research.some((item) => item.id === params.get('research'))
    ? (params.get('research') ?? '')
    : '';
  const ascending = params.get('sort') === 'asc';
  const filtered = base
    .filter((request) => {
      const owner = data.users.find((item) => item.id === request.ownerId)?.name ?? '';
      const researchName = data.research.find((item) => item.id === request.researchId)?.name ?? '';
      return (
        (!status || request.status === status) &&
        (!research || request.researchId === research) &&
        `${request.item} ${owner} ${researchName}`
          .toLocaleLowerCase('id')
          .includes(query.toLocaleLowerCase('id').trim())
      );
    })
    .sort((a, b) => requestTotal(a).cmp(requestTotal(b)) * (ascending ? 1 : -1));
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
    if (params.has('detail')) {
      const next = new URLSearchParams(params);
      next.delete('detail');
      setParams(next, { replace: true });
    }
  }
  const detailId = params.get('detail');
  const activeAction = action ?? (detailId ? { kind: 'view' as const, id: detailId } : null);
  const selected =
    activeAction && 'id' in activeAction
      ? all.find((item) => item.id === activeAction.id)
      : undefined;
  const SortIcon = ascending ? ArrowUpIcon : ArrowDownIcon;
  async function exportRows() {
    setExporting(true);
    setExportError('');
    try {
      await downloadRequests(filtered, data);
    } catch {
      setExportError('Ekspor gagal. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <section aria-label={recent ? 'Request Pembelian Terbaru' : 'Daftar Request Pembelian'}>
      {recent && (
        <div className={styles.sectionHeading}>
          <h2>Request Pembelian Terbaru</h2>
          <p>
            Kelola dan pantau{' '}
            {user.role === 'admin' ? 'semua permintaan pembelian' : 'permintaan pembelian Anda'}
          </p>
        </div>
      )}
      {!recent && user.role === 'pengaju' && (
        <div className={styles.toolbar}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setAction({ kind: 'create' })}
          >
            <PlusIcon aria-hidden="true" />
            Buat Request Baru
          </button>
        </div>
      )}
      <div className={styles.filters}>
        <div className={styles.search}>
          <MagnifyingGlassIcon aria-hidden="true" />
          <input
            aria-label="Cari request"
            type="search"
            placeholder="Cari barang, pengaju, atau jenis riset..."
            value={query}
            onInput={(event) => update('q', event.currentTarget.value)}
          />
        </div>
        <select
          aria-label="Filter status"
          className={styles.filterSelect}
          value={status}
          onInput={(event) => update('status', event.currentTarget.value)}
        >
          <option value="">Semua Status</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter jenis riset"
          className={styles.filterSelect}
          value={research}
          onInput={(event) => update('research', event.currentTarget.value)}
        >
          <option value="">Semua Jenis Riset</option>
          {data.research
            .filter((item) => user.role === 'admin' || user.researchIds.includes(item.id))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          className={`${styles.secondaryButton} ${styles.sortButton}`}
          aria-label={`Urutkan total ${ascending ? 'terbesar' : 'terkecil'}`}
          onClick={() => update('sort', ascending ? 'desc' : 'asc')}
        >
          <SortIcon aria-hidden="true" />
          Total
        </button>
        {user.role === 'admin' && (
          <button
            type="button"
            className={`${styles.primaryButton} ${styles.exportButton}`}
            disabled={exporting || filtered.length === 0}
            aria-busy={exporting}
            onClick={() => void exportRows()}
          >
            <ArrowDownTrayIcon aria-hidden="true" />
            {exporting ? 'Mengekspor...' : 'Ekspor Excel'}
          </button>
        )}
        <p className={styles.resultCount} aria-live="polite">
          Menampilkan {filtered.length ? (recent ? 1 : (page - 1) * pageSize + 1) : 0}–
          {recent ? rows.length : Math.min(page * pageSize, filtered.length)} dari {filtered.length}{' '}
          request
        </p>
        {exportError && (
          <p className={styles.formError} role="alert">
            {exportError}
          </p>
        )}
      </div>
      <div
        className={styles.tableWrap}
        tabIndex={0}
        role="region"
        aria-label="Tabel request pembelian"
      >
        <table className={styles.table}>
          <caption className="sr-only">
            {recent ? 'Lima request terbaru' : 'Daftar request'} sesuai hak akses pengguna
          </caption>
          <thead>
            <tr>
              <th scope="col">Barang</th>
              <th scope="col">Pengaju</th>
              <th scope="col">Jumlah</th>
              <th
                scope="col"
                className={styles.money}
                aria-sort={ascending ? 'ascending' : 'descending'}
              >
                Total
              </th>
              <th scope="col">Status</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id}>
                <td>{request.item}</td>
                <td>{data.users.find((owner) => owner.id === request.ownerId)?.name}</td>
                <td className={styles.quantity}>{request.quantity} unit</td>
                <td className={styles.money}>{formatMoney(requestTotal(request))}</td>
                <td>
                  <StatusBadge status={request.status} />
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.iconButton}
                      type="button"
                      data-action="view"
                      aria-label={`Lihat ${request.item}`}
                      title="Lihat detail"
                      onClick={() => setAction({ kind: 'view', id: request.id })}
                    >
                      <EyeIcon aria-hidden="true" />
                    </button>
                    {user.role === 'admin' ? (
                      <>
                        <button
                          className={styles.iconButton}
                          type="button"
                          data-action="edit"
                          aria-label={`Edit ${request.item}`}
                          title="Edit request"
                          onClick={() => setAction({ kind: 'edit', id: request.id })}
                        >
                          <PencilSquareIcon aria-hidden="true" />
                        </button>
                        <button
                          className={styles.iconButton}
                          type="button"
                          data-action="delete"
                          aria-label={`Hapus ${request.item}`}
                          title="Hapus request"
                          onClick={() => setAction({ kind: 'delete', id: request.id })}
                        >
                          <TrashIcon aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.iconButton}
                        type="button"
                        data-action="cancel"
                        aria-label={`Batalkan ${request.item}`}
                        title={
                          request.status === 'pending_review'
                            ? 'Batalkan request'
                            : 'Hanya request menunggu persetujuan yang dapat dibatalkan'
                        }
                        disabled={request.status !== 'pending_review'}
                        onClick={() => setAction({ kind: 'cancel', id: request.id })}
                      >
                        <XMarkIcon aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className={styles.empty}>
            Tidak ada request yang sesuai. Coba ubah pencarian atau filter.
          </p>
        )}
      </div>
      {!recent && (
        <Pagination
          count={filtered.length}
          page={page}
          pageSize={pageSize}
          onPage={(value) => update('page', String(value))}
          onPageSize={(value) => update('size', String(value))}
        />
      )}
      {activeAction?.kind === 'create' && <RequestEditor onClose={close} />}
      {activeAction?.kind === 'view' && selected && (
        <RequestDetails request={selected} onClose={close} />
      )}
      {activeAction?.kind === 'view' && !selected && (
        <Modal title="Request tidak tersedia" onClose={close}>
          <p role="alert">Request tidak ditemukan atau tidak dapat diakses.</p>
        </Modal>
      )}
      {activeAction?.kind === 'edit' && selected && user.role === 'admin' && (
        <RequestEditor request={selected} onClose={close} />
      )}
      {activeAction?.kind === 'delete' && selected && (
        <ConfirmDialog
          title="Hapus Request"
          description={`Hapus ${selected.item} dari daftar? Data contoh ini akan diarsipkan.`}
          confirmLabel="Hapus Request"
          onConfirm={() => deleteRequest(selected.id)}
          onClose={close}
        />
      )}
      {activeAction?.kind === 'cancel' && selected && (
        <ConfirmDialog
          title="Batalkan Request"
          description={`Batalkan pengajuan ${selected.item}? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Batalkan Request"
          onConfirm={() => cancelRequest(selected.id)}
          onClose={close}
        />
      )}
    </section>
  );
}
