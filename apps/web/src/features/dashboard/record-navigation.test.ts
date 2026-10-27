import { describe, expect, it } from 'vitest';
import { recordDestination, safeReturn } from './record-navigation';
describe('record return navigation', () => {
  it('rejects external return URLs', () => {
    for (const value of ['//example.test', 'https://example.test', '/unrelated'])
      expect(safeReturn(value, '/requests')).toBe('/requests');
  });
  it('removes redundant self-return paths after saving an edit from detail', () => {
    const list = '/requests?status=approved&page=2';
    const detail = `/requests/request-1?returnTo=${encodeURIComponent(list)}`;
    const again = `/requests/request-1?returnTo=${encodeURIComponent(detail)}`;
    expect(
      new URL(
        recordDestination('/requests/request-1', again),
        'https://stas.invalid',
      ).searchParams.get('returnTo'),
    ).toBe(list);
    expect(
      new URL(
        recordDestination('/users/demo-pengaju', '/users?q=Citra'),
        'https://stas.invalid',
      ).searchParams.get('returnTo'),
    ).toBe('/users?q=Citra');
  });
});
