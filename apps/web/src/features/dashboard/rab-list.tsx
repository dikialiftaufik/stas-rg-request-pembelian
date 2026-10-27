import { useEffect, useState } from 'react';
import Decimal from 'decimal.js';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useDemo } from '../demo/use-demo';
import { loadRabFile, scopedRabs } from '../demo/store';
import { formatDate, formatMoney, requestTotal } from '../demo/model';
import type { RabDocument } from '../demo/model';
import { ThemedSelect } from '@/components/ui/themed-select';
import { useRecordNavigation, rememberScroll } from './record-navigation';
import { FilePreview } from './file-preview';
import { Pagination } from './shared';
import { SortHeader } from './sort-header';
import { collator } from './table-sorting';
import styles from './dashboard.module.css';

async function template(kind: 'csv' | 'xlsx') {
  let blob: Blob;
  if (kind === 'csv')
    blob = new Blob(
      [
        '\ufeffNama barang,Jumlah,Satuan,Harga satuan,Keterangan\nSensor contoh,1,unit,150000,Contoh barang\n',
      ],
      { type: 'text/csv;charset=utf-8' },
    );
  else {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('RAB');
    sheet.addRow(['Nama barang', 'Jumlah', 'Satuan', 'Harga satuan', 'Keterangan']);
    sheet.addRow(['Sensor contoh', 1, 'unit', 150000, 'Contoh barang']);
    blob = new Blob([new Uint8Array(await book.xlsx.writeBuffer())], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `template-rab.${kind}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function RabDetails({ doc }: { doc: RabDocument }) {
  const { data, user } = useDemo();
  const [params, setParams] = useSearchParams();
  const { link } = useRecordNavigation('/requests/rab');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<{ blob?: Blob; error?: string }>({});
  useEffect(() => {
    if (!previewOpen) return;
    let active = true;
    void loadRabFile(doc.id)
      .then((blob) => {
        if (active) setPreview({ blob });
      })
      .catch((cause: unknown) => {
        if (active)
          setPreview({ error: cause instanceof Error ? cause.message : 'File tidak tersedia.' });
      });
    return () => {
      active = false;
    };
  }, [doc.id, previewOpen]);
  const query = params.get('itemq') ?? '';
  const key = params.get('itemSort') ?? 'name';
  const direction = params.get('itemDir') === 'desc' ? 'desc' : 'asc';
  const size = [5, 10, 20].includes(Number(params.get('itemSize')))
    ? Number(params.get('itemSize'))
    : 5;
  const rows = doc.items
    .filter((item) =>
      `${item.name} ${item.notes}`
        .toLocaleLowerCase('id')
        .includes(query.toLocaleLowerCase('id').trim()),
    )
    .toSorted((a, b) => {
      const compare =
        key === 'quantity'
          ? a.quantity - b.quantity
          : key === 'unitPrice'
            ? new Decimal(a.unitPrice).cmp(b.unitPrice)
            : key === 'total'
              ? requestTotal(a).cmp(requestTotal(b))
              : key === 'unit'
                ? collator.compare(a.unit, b.unit)
                : key === 'notes'
                  ? collator.compare(a.notes, b.notes)
                  : collator.compare(a.name, b.name);
      return compare * (direction === 'asc' ? 1 : -1) || a.id.localeCompare(b.id);
    });
  const page = Math.max(
    1,
    Math.min(Number(params.get('itemPage')) || 1, Math.max(1, Math.ceil(rows.length / size))),
  );
  function update(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'itemPage') next.delete('itemPage');
    setParams(next, { replace: true });
  }
  return (
    <section aria-label="Daftar barang RAB">
      <div className={styles.rabHeading}>
        <div>
          <h2>Daftar barang</h2>
          <p>
            {data.research.find((item) => item.id === doc.researchId)?.name} · Versi {doc.version} ·{' '}
            {doc.active ? 'Aktif' : 'Arsip'} · {formatDate(doc.createdAt)}
          </p>
        </div>
        <div>
          <span>Nilai rencana</span>
          <strong>
            {formatMoney(
              doc.items.reduce((sum, item) => sum.plus(requestTotal(item)), new Decimal(0)),
            )}
          </strong>
        </div>
      </div>
      <details
        className={styles.sourcePreview}
        onToggle={(event) => setPreviewOpen(event.currentTarget.open)}
      >
        <summary>Pratinjau dokumen sumber</summary>
        {preview.error && (
          <p role="alert" className={styles.formError}>
            {preview.error}
          </p>
        )}
        {previewOpen && preview.blob && <FilePreview blob={preview.blob} name={doc.source.name} />}
      </details>
      <div className={styles.dataPanel}>
        <div className={styles.filters}>
          <div className={styles.search}>
            <input
              type="search"
              aria-label="Cari barang RAB"
              placeholder="Cari nama barang atau keterangan…"
              value={query}
              onInput={(event) => update('itemq', event.currentTarget.value)}
            />
          </div>
        </div>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabel barang RAB">
          <table className={styles.table}>
            <caption className="sr-only">Daftar barang {doc.name}</caption>
            <thead>
              <tr>
                {(
                  [
                    ['name', 'Barang'],
                    ['quantity', 'Jumlah'],
                    ['unit', 'Satuan'],
                    ['unitPrice', 'Harga satuan'],
                    ['total', 'Total'],
                    ['notes', 'Keterangan'],
                  ] as const
                ).map(([column, label]) => (
                  <SortHeader
                    key={column}
                    label={label}
                    active={key === column}
                    direction={direction}
                    numeric={['quantity', 'unitPrice', 'total'].includes(column)}
                    onSort={() => {
                      const next = new URLSearchParams(params);
                      next.set('itemSort', column);
                      next.set('itemDir', key === column && direction === 'asc' ? 'desc' : 'asc');
                      next.delete('itemPage');
                      setParams(next, { replace: true });
                    }}
                  />
                ))}
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * size, page * size).map((item) => (
                <tr key={item.id}>
                  <td className={styles.itemCell}>{item.name}</td>
                  <td className={styles.money}>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td className={styles.money}>{formatMoney(item.unitPrice)}</td>
                  <td className={styles.money}>{formatMoney(requestTotal(item))}</td>
                  <td>{item.notes || '—'}</td>
                  <td>
                    {user?.role === 'pengaju' && doc.active ? (
                      <Link
                        className={styles.textLink}
                        to={link(
                          `/requests/new?sourceRab=${encodeURIComponent(doc.id)}&sourceItem=${encodeURIComponent(item.id)}`,
                        )}
                      >
                        Ajukan barang ini
                      </Link>
                    ) : (
                      <span className={styles.hint}>{doc.active ? 'Tersedia' : 'Arsip'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className={styles.empty}>
              Tidak ada barang yang sesuai. Coba kata pencarian lainnya.
            </p>
          )}
        </div>
        <Pagination
          count={rows.length}
          page={page}
          pageSize={size}
          onPage={(value) => update('itemPage', String(value))}
          onPageSize={(value) => update('itemSize', String(value))}
        />
      </div>
    </section>
  );
}
export function RabList() {
  const { data, user } = useDemo();
  const [params, setParams] = useSearchParams();
  const { link } = useRecordNavigation('/requests/rab');
  const [templateBusy, setTemplateBusy] = useState(false);
  if (!user) return null;
  const allowed = scopedRabs(data, user);
  const query = params.get('rabq') ?? '';
  const allVersions = params.get('versions') === 'all' && user.role === 'admin';
  const researchId = params.get('rabResearch') ?? '';
  const filtered = allowed
    .filter(
      (doc) =>
        (allVersions || doc.active) &&
        (!researchId || doc.researchId === researchId) &&
        `${doc.name} ${data.research.find((item) => item.id === doc.researchId)?.name ?? ''} ${doc.items.map((item) => item.name).join(' ')}`
          .toLocaleLowerCase('id')
          .includes(query.toLocaleLowerCase('id').trim()),
    )
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  function update(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }
  async function download(kind: 'csv' | 'xlsx') {
    setTemplateBusy(true);
    try {
      await template(kind);
      toast.success('Template RAB siap digunakan.');
    } catch {
      toast.error('Template gagal dibuat. Silakan coba lagi.');
    } finally {
      setTemplateBusy(false);
    }
  }
  return (
    <>
      <div className={styles.sectionRow}>
        <div>
          <h2>Rencana Anggaran Biaya</h2>
          <p>Baca daftar barang dan gunakan sebagai referensi Pembelian Barang.</p>
        </div>
        {user.role === 'admin' && (
          <Link
            className={styles.primaryButton}
            to={link('/requests/rab/import')}
            onClick={rememberScroll}
          >
            <ArrowUpTrayIcon aria-hidden="true" />
            Impor RAB
          </Link>
        )}
      </div>
      <div className={styles.dataPanel}>
        <div className={styles.filters}>
          <div className={styles.search}>
            <input
              type="search"
              aria-label="Cari RAB"
              placeholder="Cari RAB, riset, atau barang…"
              value={query}
              onInput={(event) => update('rabq', event.currentTarget.value)}
            />
          </div>
          <div className={styles.selectWrap}>
            <ThemedSelect
              label="Filter riset RAB"
              value={researchId}
              onValueChange={(value) => update('rabResearch', value)}
              options={[
                { value: '', label: 'Semua riset' },
                ...data.research
                  .filter((item) => user.role === 'admin' || user.researchIds.includes(item.id))
                  .map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
          {user.role === 'admin' && (
            <>
              <div className={styles.selectWrap}>
                <ThemedSelect
                  label="Versi RAB"
                  value={allVersions ? 'all' : 'active'}
                  onValueChange={(value) => update('versions', value)}
                  options={[
                    { value: 'active', label: 'Versi aktif' },
                    { value: 'all', label: 'Semua versi' },
                  ]}
                />
              </div>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={templateBusy}
                onClick={() => void download('csv')}
              >
                Template CSV
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={templateBusy}
                onClick={() => void download('xlsx')}
              >
                Template XLSX
              </button>
            </>
          )}
        </div>
        <div className={styles.rabCatalog}>
          {filtered.map((doc) => (
            <article key={doc.id}>
              <div>
                <span className={styles.hint}>
                  {data.research.find((item) => item.id === doc.researchId)?.name} · Versi{' '}
                  {doc.version} {doc.active ? 'aktif' : 'arsip'}
                </span>
                <h3>{doc.name}</h3>
                <p>
                  {doc.items.length} barang ·{' '}
                  {formatMoney(
                    doc.items.reduce((sum, item) => sum.plus(requestTotal(item)), new Decimal(0)),
                  )}{' '}
                  · {formatDate(doc.createdAt)}
                </p>
              </div>
              <Link
                className={styles.secondaryButton}
                to={link(`/requests/rab/${doc.id}`)}
                onClick={rememberScroll}
              >
                Lihat barang
              </Link>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className={styles.empty}>
              <strong>Belum ada RAB yang sesuai.</strong>
              <p>
                {user.role === 'admin'
                  ? 'Impor dokumen CSV, XLSX, atau PDF untuk mulai menyusun daftar barang.'
                  : 'Admin akan menambahkan RAB untuk riset yang Anda wakili.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
