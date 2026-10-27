import { describe, expect, it } from 'vitest';
import { getSnapshot, reloadDemoState, DEMO_STORAGE_KEY } from './store';
describe('legacy document snapshot compatibility', () => {
  it('snapshot lama mendapat default invoice, satuan dan RAB tanpa kehilangan data', () => {
    const data = getSnapshot();
    sessionStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        ...data,
        rabDocuments: undefined,
        requests: data.requests.map((request) => ({
          ...request,
          invoice: undefined,
          unit: undefined,
          rabDocumentId: undefined,
          rabItemId: undefined,
        })),
      }),
    );
    reloadDemoState();
    expect(getSnapshot().requests[0]).toMatchObject({
      invoice: null,
      unit: 'unit',
      rabDocumentId: null,
      rabItemId: null,
    });
    expect(getSnapshot().rabDocuments).toEqual([]);
  });
});
