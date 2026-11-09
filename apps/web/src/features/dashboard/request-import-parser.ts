import Decimal from 'decimal.js';
import type { ImportRequestsPayload } from '../requests/api';

export interface ParsedImportRow {
  id: string;
  originalRowNumber: number;
  item: string;
  quantity: number;
  unitPrice: string;
  date: string;
  url: string;
  completed: boolean;
  invoiceAmount: string | null;
  invoiceUrl: string;
  notes: string;
  isValid: boolean;
  validationError?: string;
  total: Decimal;
}

export interface ParseImportResult {
  validRows: ParsedImportRow[];
  invalidRows: ParsedImportRow[];
  totalRowsFound: number;
  completedCount: number;
  pendingCount: number;
  totalAmount: Decimal;
}

export function cleanMoneyString(val: unknown): string {
  if (val === null || val === undefined) return '0';
  if (typeof val === 'number') {
    return Number.isFinite(val) ? new Decimal(val).toFixed(2) : '0';
  }
  let s = String(val).trim();
  // Hilangkan awalan Rp / Rp.
  s = s.replace(/^Rp\.?\s*/i, '').trim();
  if (!s) return '0';

  // Periksa format angka Indonesia (1.336.200 atau 1.336.200,50)
  if (s.includes('.') && !s.includes(',')) {
    // Bisa jadi format titik ribuan: e.g. 1.336.200
    // Cek apakah ada kelompok 3 digit setelah titik
    const parts = s.split('.');
    if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) {
      s = s.replaceAll('.', '');
    } else if (parts.length === 2 && parts[1]?.length !== 3) {
      // e.g. 1000.50 (standar titik desimal)
      s = s;
    } else {
      s = s.replaceAll('.', '');
    }
  } else if (s.includes('.') && s.includes(',')) {
    // 1.336.200,50 -> ribuan titik, desimal koma
    s = s.replaceAll('.', '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    // 1,336,200 (ribuan koma) atau 50,5 (desimal koma)
    const parts = s.split(',');
    if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) {
      s = s.replaceAll(',', '');
    } else {
      s = s.replace(',', '.');
    }
  }

  // Buang karakter sisa non-angka/non-titik
  s = s.replace(/[^0-9.-]/g, '');
  try {
    const d = new Decimal(s);
    return d.isFinite() && d.gte(0) ? d.toFixed() : '0';
  } catch {
    return '0';
  }
}

export function parseDateString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (!s) return null;

  // DD/MM/YYYY atau DD-MM-YYYY
  const dm = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (dm && dm[1] && dm[2] && dm[3]) {
    const d = dm[1].padStart(2, '0');
    const m = dm[2].padStart(2, '0');
    const y = dm[3];
    return `${y}-${m}-${d}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Coba parse string standar
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().slice(0, 10);
  }

  return null;
}

export function parseRawTableRows(rawRows: unknown[][]): ParseImportResult {
  const validRows: ParsedImportRow[] = [];
  const invalidRows: ParsedImportRow[] = [];
  let completedCount = 0;
  let totalAmount = new Decimal(0);

  rawRows.forEach((row, rowIndex) => {
    const rowNum = rowIndex + 1;
    const cells = row.map((c) => (c === null || c === undefined ? '' : String(c).trim()));
    const fullText = cells.join(' ').toLowerCase();

    // Lewati baris kosong sepenuhnya
    if (!cells.some((c) => c.length > 0)) return;

    // Lewati baris ringkasan total / subtotal
    if (fullText.includes('total:') || fullText.includes('total sementara')) {
      return;
    }

    // Lewati baris header tabel
    if (
      cells.some((c) => {
        const u = c.toUpperCase();
        return u === 'NAMA BARANG' || u === 'NAMA' || u === 'REQUEST' || u === 'PEMBELIAN (DONE)';
      })
    ) {
      return;
    }

    // Pemetaan kolom:
    // Sesuai format spreadsheet pengadaan STAS-RG:
    // Kolom 0: NO
    // Kolom 1: TANGGAL
    // Kolom 2: NAMA BARANG
    // Kolom 3: JUMLAH BARANG
    // Kolom 4: HARGA SATUAN
    // Kolom 5: HARGA TOTAL
    // Kolom 6: HARGA TOTAL INVOICE
    // Kolom 7: LINK BARANG
    // Kolom 8: PEMBELIAN (DONE)
    // Kolom 9: LINK INVOICE
    let dateStr = parseDateString(cells[1]);
    let name = cells[2] ?? '';
    let qtyRaw = cells[3] ?? '';
    let unitPriceRaw = cells[4] ?? '';
    let invoiceAmountRaw = cells[6] ?? '';
    let linkBarang = cells[7] ?? '';
    let doneRaw = (cells[8] ?? '').toUpperCase();
    let linkInvoice = cells[9] ?? '';

    // Deteksi jika tabel tidak ada kolom NO di kolom 0 (misal kolom 0 adalah tanggal)
    if (!dateStr && parseDateString(cells[0])) {
      dateStr = parseDateString(cells[0]);
      name = cells[1] ?? '';
      qtyRaw = cells[2] ?? '';
      unitPriceRaw = cells[3] ?? '';
      linkBarang = cells[4] ?? '';
      doneRaw = (cells[5] ?? '').toUpperCase();
    }

    // Jika baris hanya punya flag TRUE/FALSE tanpa barang dan tanpa tanggal, lewati
    if (!name && !dateStr) {
      return;
    }

    const qty = parseInt(cleanMoneyString(qtyRaw), 10);
    const unitPriceClean = cleanMoneyString(unitPriceRaw);
    const unitPriceDec = new Decimal(unitPriceClean);
    const invoiceAmountClean = cleanMoneyString(invoiceAmountRaw);
    const invoiceAmountDec = new Decimal(invoiceAmountClean);

    // Evaluasi validitas
    let isValid = true;
    let errorMsg = '';

    if (!name) {
      isValid = false;
      errorMsg = 'Nama barang kosong.';
    } else if (!dateStr) {
      isValid = false;
      errorMsg = 'Tanggal tidak valid.';
    } else if (isNaN(qty) || qty <= 0) {
      isValid = false;
      errorMsg = 'Jumlah barang harus lebih dari 0.';
    } else if (unitPriceDec.lte(0)) {
      isValid = false;
      errorMsg = 'Harga satuan harus lebih dari 0.';
    }

    const isCompleted = doneRaw === 'TRUE' || doneRaw === 'YA' || doneRaw === 'DONE' || doneRaw === '1';

    let itemUrl = '';
    const extraNotes: string[] = [];

    if (linkBarang) {
      if (linkBarang.startsWith('http://') || linkBarang.startsWith('https://')) {
        itemUrl = linkBarang;
      } else {
        extraNotes.push(`Lokasi pembelian: ${linkBarang}`);
      }
    }

    let itemInvoiceUrl = '';
    if (linkInvoice) {
      if (linkInvoice.startsWith('http://') || linkInvoice.startsWith('https://')) {
        itemInvoiceUrl = linkInvoice;
      } else if (linkInvoice.toUpperCase() !== 'FALSE' && linkInvoice.toUpperCase() !== 'TRUE') {
        extraNotes.push(`Info invoice: ${linkInvoice}`);
      }
    }

    const rowTotal = isValid ? unitPriceDec.times(qty) : new Decimal(0);
    const resolvedInvoiceAmount =
      isCompleted && invoiceAmountDec.gt(0) ? invoiceAmountClean : rowTotal.toFixed();

    const parsedRow: ParsedImportRow = {
      id: `row-${rowNum}-${crypto.randomUUID().slice(0, 6)}`,
      originalRowNumber: rowNum,
      item: name,
      quantity: isNaN(qty) || qty <= 0 ? 1 : qty,
      unitPrice: unitPriceClean,
      date: dateStr ?? new Date().toISOString().slice(0, 10),
      url: itemUrl,
      completed: isCompleted,
      invoiceAmount: isCompleted ? resolvedInvoiceAmount : null,
      invoiceUrl: itemInvoiceUrl,
      notes: extraNotes.join('\n'),
      isValid,
      validationError: errorMsg,
      total: rowTotal,
    };

    if (isValid) {
      validRows.push(parsedRow);
      totalAmount = totalAmount.plus(rowTotal);
      if (isCompleted) completedCount++;
    } else {
      invalidRows.push(parsedRow);
    }
  });

  return {
    validRows,
    invalidRows,
    totalRowsFound: validRows.length + invalidRows.length,
    completedCount,
    pendingCount: validRows.length - completedCount,
    totalAmount,
  };
}

export async function parseCsvText(csvText: string): Promise<ParseImportResult> {
  const Papa = (await import('papaparse')).default;
  return new Promise((resolve) => {
    Papa.parse<string[]>(csvText, {
      delimiter: '', // Otomatis mendeteksi koma / titik koma / tab
      skipEmptyLines: false,
      complete: (results) => {
        resolve(parseRawTableRows(results.data));
      },
    });
  });
}

export async function parseImportFile(file: File): Promise<ParseImportResult> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.xlsx')) {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        validRows: [],
        invalidRows: [],
        totalRowsFound: 0,
        completedCount: 0,
        pendingCount: 0,
        totalAmount: new Decimal(0),
      };
    }

    const matrix: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const rowValues: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val: unknown = cell.value;
        if (val && typeof val === 'object' && 'text' in val) {
          val = (val as { text: unknown }).text;
        } else if (val && typeof val === 'object' && 'result' in val) {
          val = (val as { result: unknown }).result;
        }
        rowValues[colNumber - 1] = val;
      });
      matrix.push(rowValues);
    });
    return parseRawTableRows(matrix);
  }

  // Default CSV / TXT
  const text = await file.text();
  return parseCsvText(text);
}

export function toImportPayload(
  rows: ParsedImportRow[],
  researchId: string,
  sourceName?: string,
): ImportRequestsPayload {
  return {
    researchId,
    ...(sourceName ? { sourceName } : {}),
    rows: rows
      .filter((r) => r.isValid)
      .map((r) => ({
        item: r.item,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        date: r.date,
        url: r.url,
        completed: r.completed,
        invoiceAmount: r.invoiceAmount,
        invoiceUrl: r.invoiceUrl,
        notes: r.notes,
      })),
  };
}
