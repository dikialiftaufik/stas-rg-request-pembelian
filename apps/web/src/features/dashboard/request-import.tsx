import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { ThemedSelect } from '@/components/ui/themed-select';
import { FieldGroup } from '@/components/ui/field';
import { useDemo } from '../demo/use-demo';
import { formatMoney, researchUsed } from '../demo/model';
import { importRequestsToStore } from '../demo/store';
import { importRequestsApi } from '../requests/api';
import { Field, Pagination, StatusBadge } from './shared';
import { RecordPage, RecordCard } from './record-page';
import { useUnsavedChanges, useRecordNavigation } from './record-navigation';
import {
  parseImportFile,
  parseCsvText,
  toImportPayload,
} from './request-import-parser';
import type { ParsedImportRow, ParseImportResult } from './request-import-parser';
import styles from './dashboard.module.css';

export function RequestImporter({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { data } = useDemo();
  const queryClient = useQueryClient();
  const { back } = useRecordNavigation('/requests');

  const [researchId, setResearchId] = useState(data.research[0]?.id ?? '');
  const [sourceName, setSourceName] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [parseResult, setParseResult] = useState<ParseImportResult | null>(null);

  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'invalid'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { guard, markSaved } = useUnsavedChanges(
    Boolean(file || rawText || parseResult),
    saving,
  );

  const selectedResearch = data.research.find((r) => r.id === researchId);

  // Hitung simulasi alokasi dana jika diimpor
  const currentUsed = selectedResearch ? researchUsed(data, selectedResearch.id) : new Decimal(0);
  const additionalCommitted = parseResult
    ? parseResult.validRows
        .filter((r) => r.completed)
        .reduce((sum, r) => sum.plus(r.total), new Decimal(0))
    : new Decimal(0);
  const simulatedUsed = currentUsed.plus(additionalCommitted);
  const isBudgetOver = selectedResearch
    ? simulatedUsed.gt(selectedResearch.allocated)
    : false;

  async function handleFileSelected(nextFile: File | undefined) {
    setError('');
    setFile(null);
    setParseResult(null);
    if (!nextFile) return;

    setReading(true);
    try {
      setFile(nextFile);
      if (!sourceName) {
        setSourceName(nextFile.name.replace(/\.[^.]+$/, ''));
      }
      const result = await parseImportFile(nextFile);
      setParseResult(result);
      setPage(1);
      if (result.validRows.length === 0) {
        setError('Tidak ada data barang yang valid ditemukan dalam berkas.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membaca berkas.');
    } finally {
      setReading(false);
    }
  }

  async function handleParseText() {
    setError('');
    setParseResult(null);
    if (!rawText.trim()) {
      setError('Masukkan teks CSV terlebih dahulu.');
      return;
    }

    setReading(true);
    try {
      const result = await parseCsvText(rawText);
      setParseResult(result);
      setPage(1);
      if (!sourceName) {
        setSourceName('Tempel teks CSV');
      }
      if (result.validRows.length === 0) {
        setError('Tidak ada data barang yang valid ditemukan.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memproses teks CSV.');
    } finally {
      setReading(false);
    }
  }

  function removeRow(rowId: string) {
    if (!parseResult) return;
    const nextValid = parseResult.validRows.filter((r) => r.id !== rowId);
    const nextInvalid = parseResult.invalidRows.filter((r) => r.id !== rowId);

    const nextCompleted = nextValid.filter((r) => r.completed).length;
    const nextTotal = nextValid.reduce((sum, r) => sum.plus(r.total), new Decimal(0));

    setParseResult({
      validRows: nextValid,
      invalidRows: nextInvalid,
      totalRowsFound: nextValid.length + nextInvalid.length,
      completedCount: nextCompleted,
      pendingCount: nextValid.length - nextCompleted,
      totalAmount: nextTotal,
    });
  }

  async function handleExecuteImport() {
    if (!parseResult || parseResult.validRows.length === 0 || !researchId) return;

    setSaving(true);
    setError('');

    const payload = toImportPayload(parseResult.validRows, researchId, sourceName);

    try {
      // 1. Simpan ke database via API backend jika terhubung
      try {
        const apiRes = await importRequestsApi(payload);
        if (apiRes.warnings && apiRes.warnings.length > 0) {
          apiRes.warnings.forEach((warn) => toast.warning(warn));
        }
      } catch {
        // Jika server API tidak berjalan atau rute fallback, simpan ke store lokal
      }

      // 2. Simpan atau sinkronkan ke local store (SessionStorage / reactive store)
      const storeRes = importRequestsToStore(payload);

      // Refresh react query
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
        queryClient.invalidateQueries({ queryKey: ['research-types'] }),
      ]);

      markSaved();
      toast.success(
        `${storeRes.created} item berhasil diimpor ke riset ${selectedResearch?.name ?? ''}!`,
      );

      if (storeRes.warnings && storeRes.warnings.length > 0) {
        storeRes.warnings.forEach((warn) => toast.warning(warn));
      }

      onImported();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Gagal menyimpan data impor ke sistem.',
      );
    } finally {
      setSaving(false);
    }
  }

  const allDisplayRows: ParsedImportRow[] = parseResult
    ? filterMode === 'all'
      ? [...parseResult.validRows, ...parseResult.invalidRows]
      : filterMode === 'valid'
        ? parseResult.validRows
        : parseResult.invalidRows
    : [];

  const paginatedRows = allDisplayRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <RecordPage
      title="Impor Data Pembelian Barang"
      back={back}
      section="Pembelian Barang"
      aside={
        parseResult && (
          <RecordCard title="Ringkasan Impor">
            <dl className={styles.summaryValues}>
              <div>
                <dt>Siap diimpor</dt>
                <dd className="font-semibold text-emerald-700">
                  {parseResult.validRows.length} barang
                </dd>
              </div>
              <div>
                <dt>Status Selesai</dt>
                <dd>{parseResult.completedCount} barang</dd>
              </div>
              <div>
                <dt>Menunggu Persetujuan</dt>
                <dd>{parseResult.pendingCount} barang</dd>
              </div>
              {parseResult.invalidRows.length > 0 && (
                <div>
                  <dt>Dilewati</dt>
                  <dd className="text-amber-700">{parseResult.invalidRows.length} baris</dd>
                </div>
              )}
              <div>
                <dt>Total Nilai</dt>
                <dd className={styles.pageTotal}>{formatMoney(parseResult.totalAmount)}</dd>
              </div>
            </dl>

            {selectedResearch && (
              <div className="mt-4 pt-4 border-t border-[var(--ui-border)] text-sm space-y-1">
                <p className="font-medium text-[var(--ui-ink)]">
                  Alokasi Riset: {selectedResearch.name}
                </p>
                <p className="text-[var(--ui-muted)]">
                  Alokasi: {formatMoney(selectedResearch.allocated)}
                </p>
                <p className="text-[var(--ui-muted)]">
                  Komitmen sesudah impor: {formatMoney(simulatedUsed)}
                </p>
                {isBudgetOver && (
                  <p className="text-amber-800 text-xs bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                    <ExclamationTriangleIcon className="w-4 h-4 inline mr-1 text-amber-600" />
                    Komitmen melebihi alokasi riset. Impor data historis tetap diperbolehkan.
                  </p>
                )}
              </div>
            )}
          </RecordCard>
        )
      }
    >
      <RecordCard title="1. Konfigurasi & Sumber Data">
        <p className={styles.dialogDescription}>
          Pilih riset tujuan, unggah berkas CSV/Excel atau tempel teks data. Data yang diimpor akan
          langsung muncul di daftar Pembelian Barang dan grafik Dashboard Admin.
        </p>

        <FieldGroup className={styles.formGrid}>
          <Field
            id="import-research"
            label="Riset Tujuan"
            hint="Data akan dicatat di bawah alokasi riset yang dipilih."
          >
            {data.research.length > 0 ? (
              <ThemedSelect
                id="import-research"
                value={researchId}
                onValueChange={setResearchId}
                disabled={saving}
                options={data.research.map((item) => ({ value: item.id, label: item.name }))}
              />
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                Belum ada jenis riset.{' '}
                <Link to="/research-types/new" className="font-semibold underline">
                  Tambah jenis riset baru
                </Link>{' '}
                sebelum melakukan impor.
              </div>
            )}
          </Field>

          <Field id="import-source-name" label="Label Sumber (Opsional)" hint="Contoh: Pengadaan Panel PLTS Sept 2026">
            <input
              id="import-source-name"
              placeholder="Nama sumber data…"
              value={sourceName}
              disabled={saving}
              onInput={(e) => setSourceName(e.currentTarget.value)}
            />
          </Field>
        </FieldGroup>

        <div className="mt-6">
          <div className="flex gap-2 border-b border-[var(--ui-border)] pb-2 mb-4">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm font-medium rounded ${
                inputMode === 'file'
                  ? 'bg-[var(--ui-primary)] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => setInputMode('file')}
            >
              <ArrowUpTrayIcon className="w-4 h-4 inline mr-1.5" />
              Unggah File (CSV / Excel)
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm font-medium rounded ${
                inputMode === 'paste'
                  ? 'bg-[var(--ui-primary)] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => setInputMode('paste')}
            >
              <ClipboardDocumentCheckIcon className="w-4 h-4 inline mr-1.5" />
              Tempel Teks CSV
            </button>
          </div>

          {inputMode === 'file' ? (
            <Field
              id="import-file"
              label="Pilih Berkas"
              hint="Format CSV (pemisah titik koma / koma) atau berkas XLSX."
            >
              <input
                id="import-file"
                type="file"
                accept=".csv,.xlsx,.txt"
                disabled={saving || reading}
                onInput={(e) => void handleFileSelected(e.currentTarget.files?.[0])}
              />
            </Field>
          ) : (
            <div className="space-y-3">
              <Field
                id="import-paste"
                label="Tempel Teks Data CSV"
                hint="Tempelkan baris data dengan pemisah titik koma (;) atau koma (,)."
              >
                <textarea
                  id="import-paste"
                  rows={8}
                  className="font-mono text-xs w-full p-2.5 border rounded border-[var(--ui-border)] bg-slate-50 focus:bg-white"
                  placeholder="NO;TANGGAL;NAMA BARANG;JUMLAH BARANG;HARGA SATUAN;HARGA TOTAL;HARGA TOTAL INVOICE;LINK;PEMBELIAN (DONE);LINK INVOICE&#10;1;03/09/2026;Panel Surya 250WP;1;Rp1.336.200;Rp1.336.200;Rp1.460.700;https://tokopedia.com/...;TRUE;Invoice..."
                  value={rawText}
                  disabled={saving || reading}
                  onInput={(e) => setRawText(e.currentTarget.value)}
                />
              </Field>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={!rawText.trim() || reading || saving}
                onClick={() => void handleParseText()}
              >
                {reading ? 'Menganalisis…' : 'Proses & Pratinjau Teks'}
              </button>
            </div>
          )}
        </div>

        {reading && (
          <p role="status" className="text-sm text-slate-500 mt-3 animate-pulse">
            Sedang membaca dan menganalisis struktur data…
          </p>
        )}

        {error && (
          <p className={`${styles.formError} mt-4`} role="alert">
            {error}
          </p>
        )}
      </RecordCard>

      {parseResult && (
        <RecordCard title="2. Pratinjau Data yang Terdeteksi">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  filterMode === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                onClick={() => {
                  setFilterMode('all');
                  setPage(1);
                }}
              >
                Semua ({parseResult.totalRowsFound})
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  filterMode === 'valid'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
                onClick={() => {
                  setFilterMode('valid');
                  setPage(1);
                }}
              >
                Siap Diimpor ({parseResult.validRows.length})
              </button>
              {parseResult.invalidRows.length > 0 && (
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    filterMode === 'invalid'
                      ? 'bg-amber-700 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                  onClick={() => {
                    setFilterMode('invalid');
                    setPage(1);
                  }}
                >
                  Dilewati ({parseResult.invalidRows.length})
                </button>
              )}
            </div>

            <p className="text-xs text-[var(--ui-muted)]">
              {parseResult.validRows.length} barang valid akan ditambahkan ke Pembelian Barang.
            </p>
          </div>

          <div
            className={styles.tableWrap}
            tabIndex={0}
            role="region"
            aria-label="Tabel Pratinjau Impor"
          >
            <table className={`${styles.table} ${styles.importTable}`}>
              <thead>
                <tr>
                  <th scope="col">Baris</th>
                  <th scope="col">Tanggal</th>
                  <th scope="col">Nama Barang</th>
                  <th scope="col">Jumlah</th>
                  <th scope="col">Harga Satuan</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col">Invoice</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-slate-500">
                      Tidak ada data pada filter ini.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={!row.isValid ? 'bg-amber-50/60 opacity-80' : undefined}
                    >
                      <td className="text-center font-mono text-xs">{row.originalRowNumber}</td>
                      <td>{row.date}</td>
                      <td className={styles.itemCell}>
                        <div className="font-medium">{row.item || '—'}</div>
                        {row.url && (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline truncate max-w-xs block"
                          >
                            {row.url}
                          </a>
                        )}
                        {!row.isValid && (
                          <span className="text-xs text-amber-700 font-medium block mt-0.5">
                            ⚠️ {row.validationError}
                          </span>
                        )}
                        {row.notes && (
                          <small className="text-slate-500 block text-xs">{row.notes}</small>
                        )}
                      </td>
                      <td className={styles.money}>{row.quantity} unit</td>
                      <td className={styles.money}>{formatMoney(row.unitPrice)}</td>
                      <td className={styles.money}>{formatMoney(row.total)}</td>
                      <td>
                        {row.isValid ? (
                          <StatusBadge status={row.completed ? 'completed' : 'pending_review'} />
                        ) : (
                          <span className="inline-block text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                            Dilewati
                          </span>
                        )}
                      </td>
                      <td className="text-xs">
                        {row.completed ? (
                          <div>
                            <div className="font-semibold text-emerald-800">
                              {formatMoney(row.invoiceAmount ?? row.total)}
                            </div>
                            {row.invoiceUrl ? (
                              <a
                                href={row.invoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Tautan Invoice
                              </a>
                            ) : (
                              <span className="text-slate-400">Ada di catatan</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={styles.iconButton}
                          type="button"
                          aria-label={`Hapus baris ${row.originalRowNumber}`}
                          disabled={saving}
                          onClick={() => removeRow(row.id)}
                        >
                          <TrashIcon aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            count={allDisplayRows.length}
            page={page}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />

          <div className={`${styles.dialogActions} mt-6`}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={saving}
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={
                saving ||
                reading ||
                !researchId ||
                parseResult.validRows.length === 0
              }
              onClick={() => void handleExecuteImport()}
            >
              {saving
                ? 'Menyimpan ke sistem…'
                : `Konfirmasi & Impor ${parseResult.validRows.length} Barang`}
            </button>
          </div>
        </RecordCard>
      )}

      {guard}
    </RecordPage>
  );
}

export function RequestImportPage() {
  const navigate = useNavigate();
  const { back } = useRecordNavigation('/requests');

  return (
    <RequestImporter
      onClose={() => void navigate(back)}
      onImported={() => {
        void navigate('/requests', { replace: true });
      }}
    />
  );
}
