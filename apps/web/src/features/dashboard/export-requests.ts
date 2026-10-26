import type { DemoRequest, DemoSnapshot } from '../demo/model';
import { requestTotal, statusLabels } from '../demo/model';
import { currentUser } from '../demo/store';

export async function buildRequestWorkbook(rows: DemoRequest[], data: DemoSnapshot) {
  if (currentUser()?.role !== 'admin') throw new Error('Ekspor hanya tersedia untuk Admin.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STAS-RG Demo';
  const sheet = workbook.addWorksheet('Request Pembelian');
  sheet.columns = [
    { header: 'Barang', key: 'item', width: 32 },
    { header: 'Pengaju', key: 'owner', width: 28 },
    { header: 'Jenis Riset', key: 'research', width: 28 },
    { header: 'Jumlah', key: 'quantity', width: 12 },
    { header: 'Harga Satuan (Rp)', key: 'unitPrice', width: 22 },
    { header: 'Total (Rp)', key: 'total', width: 22 },
    { header: 'Status', key: 'status', width: 26 },
    { header: 'Tanggal Kebutuhan', key: 'requiredDate', width: 22 },
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
    }),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007A55' } };
  sheet.getColumn('unitPrice').numFmt = '#,##0.00';
  sheet.getColumn('total').numFmt = '#,##0.00';
  sheet.autoFilter = { from: 'A1', to: 'H1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function downloadRequests(rows: DemoRequest[], data: DemoSnapshot) {
  const bytes = await buildRequestWorkbook(rows, data);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `request-pembelian-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
