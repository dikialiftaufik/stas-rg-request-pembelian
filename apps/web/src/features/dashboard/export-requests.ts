import type { DateRangeValue } from './date-range';
import type { DemoRequest, DemoSnapshot } from '../demo/model';
import { requestTotal, statusLabels } from '../demo/model';
import { currentUser } from '../demo/store';
import { wibDay } from './date-range';

type ExportContext = { range: DateRangeValue | null; filters: string };
export async function buildRequestWorkbook(
  rows: DemoRequest[],
  data: DemoSnapshot,
  context?: ExportContext,
) {
  if (currentUser()?.role !== 'admin') throw new Error('Ekspor hanya tersedia untuk Admin.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STAS-RG Demo';
  const sheet = workbook.addWorksheet('Pembelian Barang');
  sheet.columns = [
    { header: 'Barang', key: 'item', width: 32 },
    { header: 'Pengaju', key: 'owner', width: 28 },
    { header: 'Jenis Riset', key: 'research', width: 28 },
    { header: 'Jumlah', key: 'quantity', width: 12 },
    { header: 'Harga Satuan (Rp)', key: 'unitPrice', width: 22 },
    { header: 'Total (Rp)', key: 'total', width: 22 },
    { header: 'Status', key: 'status', width: 26 },
    { header: 'Tanggal Kebutuhan', key: 'requiredDate', width: 22 },
    { header: 'Satuan', key: 'unit', width: 14 },
    { header: 'File invoice', key: 'invoice', width: 28 },
    { header: 'Tautan invoice', key: 'invoiceUrl', width: 42 },
    { header: 'Tanggal Pengajuan (WIB)', key: 'submittedDate', width: 24 },
    { header: 'Total invoice (Rp)', key: 'invoiceAmount', width: 22 },
    { header: 'Tanggal invoice', key: 'invoiceDate', width: 22 },
  ];
  rows.forEach((row) =>
    sheet.addRow({
      item: row.item,
      owner: data.users.find((user) => user.id === row.ownerId)?.name ?? '',
      research: data.research.find((item) => item.id === row.researchId)?.name ?? '',
      quantity: row.quantity,
      unitPrice: Number(row.unitPrice),
      total: requestTotal(row).toNumber(),
      status: statusLabels[row.status],
      requiredDate: row.requiredDate,
      unit: row.unit,
      invoice: row.invoice?.file?.name ?? '',
      invoiceUrl: row.invoice?.url ?? '',
      submittedDate: wibDay(row.createdAt),
      invoiceAmount: row.invoice?.amount ? Number(row.invoice.amount) : null,
      invoiceDate: row.invoice?.invoiceDate ?? '',
    }),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B43' } };
  sheet.getColumn('unitPrice').numFmt = '#,##0.00';
  sheet.getColumn('invoiceAmount').numFmt = '#,##0.00';
  sheet.getColumn('total').numFmt = '#,##0.00';
  sheet.autoFilter = { from: 'A1', to: 'N1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const info = workbook.addWorksheet('Informasi ekspor');
  info.addRows([
    ['STAS-RG Pembelian Barang'],
    ['Tanggal awal (WIB)', context?.range?.from ?? 'Semua tanggal'],
    ['Tanggal akhir (WIB)', context?.range?.to ?? 'Semua tanggal'],
    ['Filter dan urutan', context?.filters ?? ''],
    ['Jumlah request', rows.length],
    [
      'Catatan',
      'File invoice lokal ditampilkan sebagai nama berkas. Tautan eksternal tidak menyertakan blob URL.',
    ],
  ]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function downloadRequests(
  rows: DemoRequest[],
  data: DemoSnapshot,
  context?: ExportContext,
) {
  const bytes = await buildRequestWorkbook(rows, data, context);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pembelian-barang-${wibDay()}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
