import { describe, expect, it } from 'vitest';
import { createSeed } from '../demo/seed';
import {
  sortRequests,
  sortUsers,
  readSort,
  sortParams,
  requestColumns,
  userColumns,
} from './table-sorting';
import type { RequestSortKey } from './table-sorting';

describe('sorting sesuai jenis data', () => {
  const data = createSeed();
  const rows = data.requests.slice(0, 3).map((row, index) => ({
    ...row,
    item: ['Barang 10', 'barang 2', 'Alat 1'].at(index) ?? '',
    quantity: [2, 10, 1].at(index) ?? 1,
    unitPrice: ['900', '20', '1000'].at(index) ?? '1',
    status: (['approved', 'ordered', 'pending_review'] as const).at(index) ?? 'approved',
  }));
  const cases: [RequestSortKey, string[]][] = [
    ['item', ['request-3', 'request-2', 'request-1']],
    ['owner', ['request-3', 'request-1', 'request-2']],
    ['research', ['request-2', 'request-3', 'request-1']],
    ['quantity', ['request-3', 'request-1', 'request-2']],
    ['total', ['request-2', 'request-3', 'request-1']],
    ['status', ['request-1', 'request-3', 'request-2']],
    ['createdAt', ['request-3', 'request-2', 'request-1']],
  ];
  it.each(cases)('%s dapat diurutkan naik dan turun', (key, ids) => {
    expect(sortRequests(rows, data, key, 'asc').map((row) => row.id)).toEqual(ids);
    expect(sortRequests(rows, data, key, 'desc').map((row) => row.id)).toEqual(ids.toReversed());
  });
  it('nilai sama memiliki urutan ID stabil dan tidak memutasi sumber', () => {
    const tied = rows.map((row) => ({ ...row, quantity: 1, unitPrice: '100' })).toReversed();
    const before = JSON.stringify(tied);
    for (const direction of ['asc', 'desc'] as const)
      expect(sortRequests(tied, data, 'total', direction).map((row) => row.id)).toEqual([
        'request-1',
        'request-2',
        'request-3',
      ]);
    expect(JSON.stringify(tied)).toBe(before);
  });
  it('sorts submission labels and invoice numbers naturally in both directions', () => {
    const entries = rows.map((row, index) => ({
      ...row,
      submissionStatus: index === 1 ? ('submitted' as const) : ('not_submitted' as const),
      invoice: {
        number: ['0010', '0002', '0001'].at(index) ?? '',
        amount: null,
        invoiceDate: null,
        file: null,
        url: 'https://example.test/invoice',
        updatedAt: new Date().toISOString(),
        updatedBy: 'demo-admin',
      },
    }));
    expect(sortRequests(entries, data, 'submissionStatus', 'asc').map((row) => row.id)).toEqual([
      'request-1',
      'request-3',
      'request-2',
    ]);
    expect(sortRequests(entries, data, 'submissionStatus', 'desc').map((row) => row.id)).toEqual([
      'request-2',
      'request-1',
      'request-3',
    ]);
    expect(
      sortRequests(entries, data, 'invoiceNumber', 'asc').map((row) => row.invoice?.number),
    ).toEqual(['0001', '0002', '0010']);
    expect(
      sortRequests(entries, data, 'invoiceNumber', 'desc').map((row) => row.invoice?.number),
    ).toEqual(['0010', '0002', '0001']);
  });
  it('NIP/NIM menggunakan urutan natural dan mempertahankan nol awal', () => {
    const users = data.users
      .slice(0, 3)
      .map((user, index) => ({ ...user, identifier: ['0010', '0002', '0001'].at(index) ?? '' }));
    expect(sortUsers(users, data, 'identifier', 'asc').map((user) => user.identifier)).toEqual([
      '0001',
      '0002',
      '0010',
    ]);
    expect(sortUsers(users, data, 'identifier', 'desc').map((user) => user.identifier)).toEqual([
      '0010',
      '0002',
      '0001',
    ]);
  });
  it('seluruh kolom pengguna mendukung dua arah tanpa mengubah data', () => {
    const before = JSON.stringify(data);
    for (const key of userColumns)
      for (const direction of ['asc', 'desc'] as const)
        expect(sortUsers(data.users, data, key, direction)).toHaveLength(data.users.length);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('URL lama, parameter invalid, pergantian kolom dan reset pagination ditangani', () => {
    expect(
      readSort(new URLSearchParams('sort=asc'), requestColumns, 'createdAt', 'desc', true),
    ).toEqual({ key: 'total', direction: 'asc' });
    expect(
      readSort(new URLSearchParams('sortBy=invalid'), requestColumns, 'createdAt', 'desc', true),
    ).toEqual({ key: 'createdAt', direction: 'desc' });
    const params = new URLSearchParams('q=sensor&page=3&sort=desc');
    const next = sortParams(params, 'item', 'total', 'desc');
    expect(next.get('q')).toBe('sensor');
    expect(next.has('page')).toBe(false);
    expect(next.has('sort')).toBe(false);
    expect(next.get('sortDir')).toBe('asc');
    expect(sortParams(next, 'item', 'item', 'asc').get('sortDir')).toBe('desc');
  });
});
