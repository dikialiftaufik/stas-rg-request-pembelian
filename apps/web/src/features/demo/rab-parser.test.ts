import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { inferMapping, mappedItems, parseAmount, parseRabSource } from './rab-parser';
import { rabItemInputSchema } from './model';
describe('parser RAB', () => {
  it('membaca CSV berpetik, delimiter titik koma dan angka Indonesia', async () => {
    const sheets = await parseRabSource(
      new File(
        [
          'Nama barang;Jumlah;Satuan;Harga satuan;Keterangan\n"Sensor; presisi";2;set;"1.250.000,50";"Dua, sensor"',
        ],
        'contoh.csv',
      ),
    );
    const sheet = sheets[0];
    if (!sheet) throw new Error('CSV kosong');
    expect(mappedItems(sheet, inferMapping(sheet.headers), 'id')[0]).toMatchObject({
      name: 'Sensor; presisi',
      quantity: 2,
      unitPrice: '1250000.50',
      notes: 'Dua, sensor',
    });
  });
  it('mempertahankan nilai numerik XLSX dan hasil formula tersimpan tanpa menjalankannya', async () => {
    const book = new ExcelJS.Workbook();
    for (const name of ['Utama', 'Tambahan']) {
      const sheet = book.addWorksheet(name);
      sheet.addRow(['Barang', 'Jumlah', 'Harga']);
      sheet.addRow(['Sensor', 2, 1250.5]);
      sheet.addRow(['Tanpa cache', 1, { formula: '1+2' }]);
    }
    const bytes = new Uint8Array(await book.xlsx.writeBuffer());
    const sheets = await parseRabSource(new File([bytes], 'contoh.xlsx'));
    expect(sheets.map((item) => item.name)).toEqual(['Utama', 'Tambahan']);
    const sheet = sheets[0];
    if (!sheet) throw new Error('XLSX kosong');
    const rows = mappedItems(sheet, inferMapping(sheet.headers), 'id');
    expect(rows[0]?.unitPrice).toBe('1250.5');
    expect(rabItemInputSchema.safeParse(rows[1]).success).toBe(false);
  });
  it('menolak pemetaan wajib yang hilang dan lebih dari 1.000 baris', async () => {
    expect(() => mappedItems({ name: 'CSV', headers: [], rows: [] }, new Map(), 'id')).toThrow(
      /Petakan/,
    );
    await expect(
      parseRabSource(
        new File(['Barang,Jumlah,Harga\n' + 'Sensor,1,100\n'.repeat(1001)], 'besar.csv'),
      ),
    ).rejects.toThrow(/1.000/);
    expect(parseAmount(1250.5, 'id')).toBe('1250.5');
    expect(() => parseAmount('1.23.456', 'id')).toThrow(/Format/);
    expect(() => parseAmount('1,250.50', 'id')).toThrow(/Format/);
    const invalid = mappedItems(
      { name: 'CSV', headers: ['Barang', 'Jumlah', 'Harga'], rows: [['Sensor', 1, '1.50']] },
      inferMapping(['Barang', 'Jumlah', 'Harga']),
      'id',
    );
    expect(rabItemInputSchema.safeParse(invalid[0]).success).toBe(false);
  });
});
