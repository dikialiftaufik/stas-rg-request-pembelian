import Decimal from 'decimal.js';
import { z } from 'zod';
import type { RabItemInput } from './model';
import { fileBytes } from './attachment-db';

export type RawCell = string | number | null;
export type RawSheet = { name: string; headers: string[]; rows: RawCell[][] };
export const fields = ['name', 'quantity', 'unit', 'unitPrice', 'notes'] as const;
export type RabField = (typeof fields)[number];
export type ColumnMapping = Map<RabField, number | null>;
const aliases = new Map<RabField, string[]>([
  ['name', ['nama barang', 'barang', 'item', 'nama']],
  ['quantity', ['jumlah', 'qty', 'quantity', 'volume']],
  ['unit', ['satuan', 'unit']],
  ['unitPrice', ['harga satuan', 'harga', 'unit price', 'price']],
  ['notes', ['keterangan', 'catatan', 'notes', 'spesifikasi']],
]);
export function inferMapping(headers: string[]): ColumnMapping {
  return new Map(
    fields
      .map((field) => [
        field,
        headers.findIndex((header) => aliases.get(field)?.includes(header.trim().toLowerCase())),
      ])
      .map(([field, index]) => [field as RabField, Number(index) < 0 ? null : Number(index)]),
  );
}
export function parseAmount(value: RawCell, locale: 'id' | 'standard'): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Angka tidak valid.');
    return new Decimal(value).toFixed();
  }
  const raw = String(value ?? '')
    .trim()
    .replace(/^Rp\s*/i, '');
  const decimalSeparator = locale === 'id' ? ',' : '.';
  const groupingSeparator = locale === 'id' ? '.' : ',';
  const parts = raw.split(decimalSeparator);
  const whole = parts[0] ?? '';
  const decimals = parts[1];
  const groups = whole.split(groupingSeparator);
  const digits = (text: string) => /^\d+$/.test(text);
  const wholeValid =
    groups.length === 1
      ? digits(whole)
      : groups.every(
          (group, index) =>
            digits(group) &&
            (index === 0 ? group.length >= 1 && group.length <= 3 : group.length === 3),
        );
  if (
    raw.length > 100 ||
    parts.length > 2 ||
    !wholeValid ||
    (decimals !== undefined && (!digits(decimals) || decimals.length > 2))
  )
    throw new Error('Format angka tidak sesuai.');
  return locale === 'id' ? raw.replaceAll('.', '').replace(',', '.') : raw.replaceAll(',', '');
}
export function mappedItems(
  sheet: RawSheet,
  mapping: ColumnMapping,
  locale: 'id' | 'standard',
): RabItemInput[] {
  for (const field of ['name', 'quantity', 'unitPrice'] as const)
    if (mapping.get(field) === null || mapping.get(field) === undefined)
      throw new Error('Petakan nama barang, jumlah, dan harga satuan terlebih dahulu.');
  return sheet.rows.map((row) => {
    const cell = (field: RabField): RawCell => {
      const index = mapping.get(field);
      return index === null || index === undefined ? null : (row.at(index) ?? null);
    };
    let price: string;
    let quantity: number;
    try {
      price = parseAmount(cell('unitPrice'), locale);
    } catch {
      const raw = String(cell('unitPrice') ?? '');
      price = raw ? `${raw} (format tidak sesuai)` : '';
    }
    try {
      quantity = Number(parseAmount(cell('quantity'), locale));
    } catch {
      quantity = Number.NaN;
    }
    return {
      name: String(cell('name') ?? ''),
      quantity,
      unit: String(cell('unit') ?? 'unit') || 'unit',
      unitPrice: price,
      notes: String(cell('notes') ?? ''),
    };
  });
}
function asCell(value: unknown): RawCell {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'result' in value) return asCell(value.result);
  if (value && typeof value === 'object' && 'text' in value && typeof value.text === 'string')
    return value.text;
  return null;
}
export async function parseRabSource(file: File): Promise<RawSheet[]> {
  const bytes = await fileBytes(file);
  if (file.name.toLowerCase().endsWith('.csv')) {
    const { default: Papa } = await import('papaparse');
    const result = Papa.parse<string[]>(new TextDecoder().decode(bytes), {
      skipEmptyLines: 'greedy',
      preview: 1002,
    });
    if (result.errors.length)
      throw new Error('CSV tidak dapat dibaca. Periksa tanda kutip dan pemisah kolom.');
    const [header, ...rows] = result.data;
    if (!header || !rows.length) throw new Error('CSV belum berisi judul kolom dan barang.');
    if (rows.length > 1000)
      throw new Error('Maksimal 1.000 barang per impor. Pisahkan file menjadi beberapa bagian.');
    return [{ name: 'CSV', headers: header, rows }];
  }
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook.worksheets
    .map((sheet) => {
      const rows: RawCell[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        if (rows.length > 1000) throw new Error('Maksimal 1.000 barang per worksheet.');
        const cells: RawCell[] = [];
        if (row.cellCount > 100)
          throw new Error('Maksimal 100 kolom per worksheet. Gunakan template RAB.');
        for (let column = 1; column <= row.cellCount; column++)
          cells.push(asCell(row.getCell(column).value));
        rows.push(cells);
      });
      const [headers = [], ...items] = rows;
      return {
        name: sheet.name,
        headers: headers.map((cell, index) => String(cell ?? `Kolom ${index + 1}`)),
        rows: items,
      };
    })
    .filter((sheet) => sheet.rows.length > 0);
}
const resultSchema = z.array(
  z.object({
    name: z.string(),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  }),
);
export async function parseRabInWorker(file: File, signal: AbortSignal): Promise<RawSheet[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./rab-worker.ts', import.meta.url), { type: 'module' });
    const stop = () => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      stop();
      reject(new DOMException('Impor dibatalkan', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<unknown>) => {
      stop();
      const data = event.data;
      if (data && typeof data === 'object' && 'sheets' in data) {
        const parsed = resultSchema.safeParse(data.sheets);
        if (parsed.success) {
          resolve(parsed.data);
          return;
        }
      }
      reject(
        new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'File tidak dapat dibaca. Gunakan template CSV/XLSX.',
        ),
      );
    };
    worker.onerror = () => {
      stop();
      reject(new Error('File tidak dapat diproses. Coba gunakan template CSV/XLSX.'));
    };
    worker.postMessage(file);
  });
}
