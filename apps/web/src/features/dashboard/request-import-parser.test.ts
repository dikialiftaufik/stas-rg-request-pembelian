import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  cleanMoneyString,
  parseDateString,
  parseCsvText,
  toImportPayload,
} from './request-import-parser';

describe('request-import-parser', () => {
  it('cleans Indonesian money strings correctly', () => {
    expect(cleanMoneyString('Rp1.336.200')).toBe('1336200');
    expect(cleanMoneyString('Rp.69.360')).toBe('69360');
    expect(cleanMoneyString('Rp 1.460.700')).toBe('1460700');
    expect(cleanMoneyString('12000')).toBe('12000');
    expect(cleanMoneyString('Rp0')).toBe('0');
    expect(cleanMoneyString('')).toBe('0');
  });

  it('parses dates in DD/MM/YYYY and YYYY-MM-DD formats', () => {
    expect(parseDateString('03/09/2026')).toBe('2026-09-03');
    expect(parseDateString('04/09/2026')).toBe('2026-09-04');
    expect(parseDateString('01/10/2026')).toBe('2026-10-01');
    expect(parseDateString('2026-09-03')).toBe('2026-09-03');
    expect(parseDateString('invalid')).toBe(null);
  });

  it('parses multi-section user CSV data properly', async () => {
    const sampleCsv = `;;;;;;;;;;;;;
NO;TANGGAL;REQUEST;;;;;;PEMBELIAN (DONE);;;;;
;;NAMA BARANG;JUMLAH BARANG;HARGA SATUAN;HARGA TOTAL;HARGA TOTAL INVOICE;LINK;;LINK INVOICE;;;;
1;03/09/2026;PROMO Panel Surya Mono 250 WP Solar 250WP;1;Rp1.336.200;Rp1.336.200;Rp1.460.700;https://tk.tokopedia.com/ZSb1YT36b/;TRUE;Invoice | Tokopedia;;;;
2;03/09/2026;PowMr Hybrid Solar Inverter;1;Rp2.795.941;Rp2.795.941;Rp2.865.956;https://tokopedia.com/...;TRUE;https://tokopedia.com/inv/123;;;;
15;23/09/2026;Panel Surya 110 x 69;1;Rp25.000;Rp25.000;Rp25.000;onsite;TRUE;;;;;
;;;;TOTAL:;Rp4.157.141;Rp4.351.656;;;;;;;
;;;;;;;;;;;;;
NO;TANGGAL;REQUEST;;;;;;PEMBELIAN (DONE);;;;;
;;NAMA BARANG;JUMLAH BARANG;HARGA SATUAN;HARGA TOTAL;;LINK;;;;;;
1;04/09/2026;Mysolar Panel Surya;1;Rp1.355.000;Rp1.355.000;;https://tokopedia.com/...;FALSE;FALSE;;;;
4;04/09/2026;MCB;;;Rp0;;;FALSE;FALSE;;;;
;;;;TOTAL:;Rp1.355.000;;;;;;;;`;

    const result = await parseCsvText(sampleCsv);

    expect(result.validRows.length).toBe(4);
    expect(result.completedCount).toBe(3);
    expect(result.pendingCount).toBe(1);
    expect(result.invalidRows.length).toBe(1); // MCB without qty/price

    // Item 1 (Panel Surya)
    const item1 = result.validRows[0]!;
    expect(item1.item).toBe('PROMO Panel Surya Mono 250 WP Solar 250WP');
    expect(item1.quantity).toBe(1);
    expect(item1.unitPrice).toBe('1336200');
    expect(item1.date).toBe('2026-09-03');
    expect(item1.completed).toBe(true);
    expect(item1.invoiceAmount).toBe('1460700');
    expect(item1.url).toBe('https://tk.tokopedia.com/ZSb1YT36b/');
    expect(item1.notes).toContain('Invoice | Tokopedia');

    // Item 3 (onsite item)
    const item3 = result.validRows[2]!;
    expect(item3.item).toBe('Panel Surya 110 x 69');
    expect(item3.url).toBe('');
    expect(item3.notes).toContain('onsite');

    // Item 4 (pending Mysolar)
    const item4 = result.validRows[3]!;
    expect(item4.item).toBe('Mysolar Panel Surya');
    expect(item4.completed).toBe(false);

    // Total amount
    const expectedTotal = new Decimal(1336200)
      .plus(2795941)
      .plus(25000)
      .plus(1355000);
    expect(result.totalAmount.equals(expectedTotal)).toBe(true);

    // Convert to import payload
    const payload = toImportPayload(result.validRows, 'smart-grid', 'Uji Coba');
    expect(payload.researchId).toBe('smart-grid');
    expect(payload.sourceName).toBe('Uji Coba');
    expect(payload.rows.length).toBe(4);
  });
});
