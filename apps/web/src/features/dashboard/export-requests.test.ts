import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildRequestWorkbook } from './export-requests';
import { currentUser, getSnapshot, loginDemo, scopedRequests } from '../demo/store';

describe('ekspor workbook', () => {
  it('menghasilkan XLSX yang dapat dibaca dengan urutan dan isi sesuai daftar', async () => {
    loginDemo('admin@gmail.com', 'admin123');
    const data = getSnapshot();
    const user = currentUser();
    if (!user) throw new Error('Akun tidak tersedia');
    const rows = scopedRequests(data, user)
      .filter((item) => item.status === 'pending_review')
      .slice(0, 2);
    const bytes = await buildRequestWorkbook(rows, data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer);
    const sheet = workbook.getWorksheet('Request Pembelian');
    expect(sheet?.rowCount).toBe(3);
    expect(sheet?.getCell('A2').value).toBe(rows[0]?.item);
    expect(sheet?.getCell('A3').value).toBe(rows[1]?.item);
    expect(sheet?.getCell('F2').value).toBe(12500000);
    expect(sheet?.getCell('G2').value).toBe('Menunggu Persetujuan');
  });
  it('menolak ekspor dari Pengaju', async () => {
    loginDemo('pengaju@gmail.com', 'pengaju123');
    await expect(buildRequestWorkbook([], getSnapshot())).rejects.toThrow(/Admin/);
  });
});
