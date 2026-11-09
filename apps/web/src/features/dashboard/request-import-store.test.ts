import { describe, expect, it } from 'vitest';
import { importRequestsToStore, getSnapshot, loginDemo, saveResearch } from '../demo/store';

describe('importRequestsToStore', () => {
  it('imports requests into demo store for Admin without error', () => {
    // Login as admin
    expect(loginDemo('admin@gmail.com', 'admin123')).toBe(true);

    const researchId = saveResearch({
      name: 'Riset PLTS Surya',
      description: 'Pengembangan PLTS Mandiri',
      allocated: '100000000',
    });

    const snapshotBefore = getSnapshot();
    const initialRequestCount = snapshotBefore.requests.length;

    const result = importRequestsToStore({
      researchId,
      sourceName: 'Test Import CSV',
      rows: [
        {
          item: 'Solar Panel 250WP',
          quantity: 2,
          unitPrice: '1336200',
          date: '2026-09-03',
          url: 'https://tokopedia.com/...',
          completed: true,
          invoiceAmount: '2800000',
          invoiceUrl: '',
          notes: 'Invoice terlampir',
        },
        {
          item: 'Hybrid Inverter 1.6KW',
          quantity: 1,
          unitPrice: '2795941',
          date: '2026-09-04',
          url: '',
          completed: false,
          notes: '',
        },
      ],
    });

    expect(result.created).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.pending).toBe(1);

    const snapshotAfter = getSnapshot();
    expect(snapshotAfter.requests.length).toBe(initialRequestCount + 2);

    const imported1 = snapshotAfter.requests[0]!;
    const imported2 = snapshotAfter.requests[1]!;

    expect(imported1.ownerId).toBe(null);
    expect(imported1.researchId).toBe(researchId);
    expect(imported1.status).toBe('completed');
    expect(imported2.ownerId).toBe(null);
    expect(imported2.status).toBe('pending_review');
  });
});
