import Decimal from 'decimal.js';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ThemedSelect } from '@/components/ui/themed-select';
import { useDemo } from '../demo/use-demo';
import { importRab } from '../demo/store';
import { rabItemInputSchema, formatMoney, requestTotal } from '../demo/model';
import type { RabItemInput } from '../demo/model';
import { inferMapping, mappedItems, parseRabInWorker, fields } from '../demo/rab-parser';
import type { ColumnMapping, RabField, RawSheet } from '../demo/rab-parser';
import { validateFile } from '../demo/file-validation';
import { Field, Pagination } from './shared';
import { RecordPage, RecordCard } from './record-page';
import { useUnsavedChanges, useRecordNavigation } from './record-navigation';
import { FieldGroup } from '@/components/ui/field';
import { FilePreview } from './file-preview';
import styles from './dashboard.module.css';
type DraftRow = { id: string; values: RabItemInput };
const fieldLabels = new Map<RabField, string>([
  ['name', 'Nama barang'],
  ['quantity', 'Jumlah'],
  ['unit', 'Satuan'],
  ['unitPrice', 'Harga satuan'],
  ['notes', 'Keterangan'],
]);
const blank = (): DraftRow => ({
  id: crypto.randomUUID(),
  values: { name: '', quantity: 1, unit: 'unit', unitPrice: '', notes: '' },
});

export function RabImporter({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (id: string) => void;
}) {
  const { data } = useDemo();
  const [researchId, setResearchId] = useState(data.research[0]?.id ?? '');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [sheets, setSheets] = useState<RawSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState('0');
  const [mapping, setMapping] = useState<ColumnMapping>(new Map());
  const [locale, setLocale] = useState<'id' | 'standard'>('id');
  const [stage, setStage] = useState<'file' | 'mapping' | 'review'>('file');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pageValue, setPage] = useState(1);
  const [size, setSize] = useState(5);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const { back } = useRecordNavigation('/requests/rab');
  const { guard, markSaved } = useUnsavedChanges(Boolean(file || name || reading), saving);
  const invalid = rows.filter((row) => !rabItemInputSchema.safeParse(row.values).success).length;
  const page = Math.min(pageValue, Math.max(1, Math.ceil(rows.length / size)));
  const sheet = sheets.at(Number(sheetIndex));
  const total = rows.reduce((sum, row) => {
    const value = rabItemInputSchema.safeParse(row.values);
    return value.success ? sum.plus(requestTotal(value.data)) : sum;
  }, new Decimal(0));
  async function chooseFile(next: File | undefined) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError('');
    setFile(null);
    setPdf(null);
    setRows([]);
    setSheets([]);
    setStage('file');
    if (!next) return;
    setReading(true);
    try {
      const mime = await validateFile(next, 'rab');
      if (abort.signal.aborted) return;
      if (mime === 'application/pdf') {
        setPdf(next.slice(0, next.size, mime));
        setRows([blank()]);
        setStage('review');
      } else {
        const parsed = await parseRabInWorker(next, abort.signal);
        if (!parsed.length)
          throw new Error('Tidak ada worksheet berisi barang. Gunakan template RAB.');
        setSheets(parsed);
        setSheetIndex('0');
        setMapping(inferMapping(parsed[0]?.headers ?? []));
        setLocale(next.name.toLowerCase().endsWith('.xlsx') ? 'standard' : 'id');
        setStage('mapping');
      }
      setFile(next);
      setName(next.name.replace(/\.[^.]+$/, ''));
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'File tidak dapat dibaca.');
    } finally {
      if (!abort.signal.aborted) setReading(false);
    }
  }
  function updateRow(id: string, update: (value: RabItemInput) => RabItemInput) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, values: update(row.values) } : row)),
    );
  }
  async function save() {
    if (!file || invalid || !rows.length) return;
    setSaving(true);
    setError('');
    try {
      const id = await importRab({ researchId, name, file, items: rows.map((row) => row.values) });
      toast.success('RAB berhasil diimpor. Daftar barang siap digunakan.');
      markSaved();
      onImported(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'RAB gagal disimpan. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <RecordPage
      title="Impor Rencana Anggaran Biaya"
      back={back}
      section="RAB"
      aside={
        <RecordCard title="Ringkasan impor">
          <p>
            {rows.length} barang · {invalid} perlu diperiksa
          </p>
          <p className={styles.pageTotal}>{formatMoney(total)}</p>
          <p className={styles.hint}>
            Versi baru mempertahankan dokumen yang dirujuk request lama.
          </p>
        </RecordCard>
      }
    >
      <RecordCard title="Dokumen dan daftar barang">
        <p className={styles.dialogDescription}>
          Pilih riset, periksa isi dokumen, lalu simpan daftar barang. Nilai RAB tidak mengubah
          alokasi riset.
        </p>
        <ol className={styles.importSteps} aria-label="Tahapan impor">
          <li data-active={stage === 'file'}>1. Pilih file</li>
          <li data-active={stage === 'mapping'}>2. Petakan kolom</li>
          <li data-active={stage === 'review'}>3. Periksa barang</li>
        </ol>
        {data.rabDocuments.some((doc) => doc.researchId === researchId) && (
          <p className={styles.hint}>
            Impor berikutnya menjadi versi baru. Barang dan dokumen yang dirujuk request lama tetap
            dipertahankan.
          </p>
        )}
        <FieldGroup className={styles.formGrid}>
          <Field id="rab-research" label="Riset tujuan">
            <ThemedSelect
              id="rab-research"
              value={researchId}
              onValueChange={setResearchId}
              disabled={saving}
              options={data.research.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Field>
          <Field
            id="rab-file"
            label="Dokumen RAB"
            hint="CSV, XLSX, atau PDF. Maksimal 10 MB dan 1.000 barang."
          >
            <input
              id="rab-file"
              type="file"
              accept=".csv,.xlsx,.pdf"
              disabled={saving}
              onInput={(event) => void chooseFile(event.currentTarget.files?.[0])}
            />
          </Field>
          {file && (
            <Field id="rab-name" label="Nama RAB">
              <input
                id="rab-name"
                value={name}
                disabled={saving}
                onInput={(event) => setName(event.currentTarget.value)}
              />
            </Field>
          )}
        </FieldGroup>
        {reading && (
          <p role="status" className={styles.hint}>
            Membaca dokumen… Anda dapat membatalkan tanpa menyimpan.
          </p>
        )}
        {stage === 'mapping' && sheet && (
          <section className={styles.mappingSection} aria-label="Pemetaan kolom RAB">
            <div className={styles.formGrid}>
              <Field id="rab-sheet" label="Worksheet">
                <ThemedSelect
                  id="rab-sheet"
                  value={sheetIndex}
                  onValueChange={(value) => {
                    setSheetIndex(value);
                    setMapping(inferMapping(sheets.at(Number(value))?.headers ?? []));
                  }}
                  options={sheets.map((item, index) => ({
                    value: String(index),
                    label: `${item.name} (${item.rows.length} barang)`,
                  }))}
                />
              </Field>
              <Field id="rab-number-format" label="Format angka">
                <ThemedSelect
                  id="rab-number-format"
                  value={locale}
                  onValueChange={(value) => setLocale(value === 'id' ? 'id' : 'standard')}
                  options={[
                    { value: 'id', label: 'Indonesia: 1.250.000,50' },
                    { value: 'standard', label: 'Internasional: 1,250,000.50' },
                  ]}
                />
              </Field>
              {fields.map((field) => (
                <Field key={field} id={`map-${field}`} label={fieldLabels.get(field) ?? field}>
                  <ThemedSelect
                    id={`map-${field}`}
                    value={
                      mapping.get(field) === null || mapping.get(field) === undefined
                        ? ''
                        : String(mapping.get(field))
                    }
                    onValueChange={(value) =>
                      setMapping((current) =>
                        new Map(current).set(field, value === '' ? null : Number(value)),
                      )
                    }
                    options={[
                      { value: '', label: 'Tidak dipetakan' },
                      ...sheet.headers.map((header, index) => ({
                        value: String(index),
                        label: `${index + 1}. ${header}`,
                      })),
                    ]}
                  />
                </Field>
              ))}
            </div>
            <p className={styles.hint}>
              Nama barang, jumlah, dan harga satuan wajib dipetakan. Formula Excel tidak dijalankan.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  try {
                    setRows(
                      mappedItems(sheet, mapping, locale).map((values, index) => ({
                        id: `mapped-${index}`,
                        values,
                      })),
                    );
                    setPage(1);
                    setStage('review');
                    setError('');
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Pemetaan belum lengkap.');
                  }
                }}
              >
                Tinjau barang
              </button>
            </div>
          </section>
        )}
        {stage === 'review' && (
          <section className={styles.mappingSection} aria-label="Pemeriksaan barang RAB">
            {pdf && (
              <>
                <p className={styles.hint}>
                  PDF menjadi dokumen sumber. Isi daftar barang berdasarkan PDF; tidak ada ekstraksi
                  otomatis.
                </p>
                <FilePreview blob={pdf} name={file?.name ?? 'RAB.pdf'} />
              </>
            )}
            <div className={styles.sectionRow}>
              <h3>
                {rows.length} barang · {formatMoney(total)}
              </h3>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={rows.length >= 1000 || saving}
                onClick={() => {
                  setRows((current) => [...current, blank()]);
                  setPage(Math.ceil((rows.length + 1) / size));
                }}
              >
                <PlusIcon aria-hidden="true" />
                Tambah baris
              </button>
            </div>
            <div
              className={styles.tableWrap}
              tabIndex={0}
              role="region"
              aria-label="Tabel koreksi RAB"
            >
              <table className={`${styles.table} ${styles.importTable}`}>
                <thead>
                  <tr>
                    {[
                      'Barang',
                      'Jumlah',
                      'Satuan',
                      'Harga satuan (Rp)',
                      'Keterangan',
                      'Total / validasi',
                      'Aksi',
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * size, page * size).map((row, index) => {
                    const number = (page - 1) * size + index + 1;
                    const result = rabItemInputSchema.safeParse(row.values);
                    return (
                      <tr key={row.id}>
                        <td>
                          <input
                            aria-label={`Nama barang baris ${number}`}
                            value={row.values.name}
                            disabled={saving}
                            onInput={(event) => {
                              const value = event.currentTarget.value;
                              updateRow(row.id, (old) => ({ ...old, name: value }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Jumlah baris ${number}`}
                            type="number"
                            min={1}
                            step={1}
                            value={Number.isFinite(row.values.quantity) ? row.values.quantity : ''}
                            disabled={saving}
                            onInput={(event) => {
                              const value = Number(event.currentTarget.value);
                              updateRow(row.id, (old) => ({ ...old, quantity: value }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Satuan baris ${number}`}
                            value={row.values.unit}
                            disabled={saving}
                            onInput={(event) => {
                              const value = event.currentTarget.value;
                              updateRow(row.id, (old) => ({ ...old, unit: value }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Harga satuan baris ${number}`}
                            inputMode="decimal"
                            value={row.values.unitPrice}
                            disabled={saving}
                            onInput={(event) => {
                              const value = event.currentTarget.value;
                              updateRow(row.id, (old) => ({ ...old, unitPrice: value }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Keterangan baris ${number}`}
                            value={row.values.notes}
                            disabled={saving}
                            onInput={(event) => {
                              const value = event.currentTarget.value;
                              updateRow(row.id, (old) => ({ ...old, notes: value }));
                            }}
                          />
                        </td>
                        <td>
                          {result.success ? (
                            formatMoney(requestTotal(result.data))
                          ) : (
                            <span className={styles.formError}>
                              {result.error.issues.map((issue) => issue.message).join(' ')}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className={styles.iconButton}
                            type="button"
                            aria-label={`Hapus baris ${number}`}
                            disabled={saving}
                            onClick={() =>
                              setRows((current) => current.filter((item) => item.id !== row.id))
                            }
                          >
                            <TrashIcon aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              count={rows.length}
              page={page}
              pageSize={size}
              onPage={setPage}
              onPageSize={(value) => {
                setSize(value);
                setPage(1);
              }}
            />
            <p className={styles.hint}>
              Harga koreksi menggunakan angka tanpa pemisah ribuan.{' '}
              {invalid ? `${invalid} baris perlu diperbaiki.` : 'Seluruh baris valid.'}
            </p>
          </section>
        )}
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={saving}
            onClick={() => {
              controller.current?.abort();
              onClose();
            }}
          >
            Batal impor
          </button>
          {stage === 'review' && (
            <button
              className={styles.primaryButton}
              type="button"
              disabled={
                saving || reading || invalid > 0 || rows.length === 0 || !name.trim() || !researchId
              }
              onClick={() => void save()}
            >
              {saving ? 'Menyimpan…' : 'Konfirmasi impor'}
            </button>
          )}
        </div>
        {guard}
      </RecordCard>
    </RecordPage>
  );
}
