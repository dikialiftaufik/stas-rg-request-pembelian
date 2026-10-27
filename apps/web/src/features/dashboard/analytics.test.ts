import { describe, expect, it } from 'vitest';
import { createSeed } from '../demo/seed';
import {
  trendAnalytics,
  lastEightWeeks,
  urgencyAnalytics,
  personalFollowup,
  personalReceiptTrend,
  dayDifference,
} from './analytics';
import { datePresets, inDateRange, readDateRange } from './date-range';
import { legacyDestination } from './legacy-navigation';
const now = new Date('2026-10-26T02:00:00Z');
describe('WIB periods and analytics', () => {
  it('uses inclusive WIB boundaries and Monday-based weeks', () => {
    const range = { from: '2026-10-26', to: '2026-10-26' };
    expect(inDateRange('2026-10-25T17:00:00Z', range)).toBe(true);
    expect(inDateRange('2026-10-26T16:59:59Z', range)).toBe(true);
    expect(inDateRange('2026-10-26T17:00:00Z', range)).toBe(false);
    expect(readDateRange(new URLSearchParams('from=2026-10-27&to=2026-10-26'))).toBeNull();
    expect(
      new Map(datePresets(now).map((item) => [item.label, item.range])).get('Minggu ini'),
    ).toEqual(range);
    expect(dayDifference('2026-12-31', '2027-01-01')).toBe(1);
  });
  it('zero-fills weeks and sums exact Decimal values across the WIB boundary', () => {
    const source = createSeed().requests[0]!;
    const rows = [
      { ...source, id: 'a', createdAt: '2026-10-25T17:00:00Z', unitPrice: '0.1', quantity: 3 },
      { ...source, id: 'b', createdAt: '2026-10-25T16:59:59Z', unitPrice: '0.2' },
      { ...source, id: 'c', deleted: true },
    ];
    const result = trendAnalytics(rows, lastEightWeeks(now), now);
    expect(result.unit).toBe('week');
    expect(result.trend).toHaveLength(8);
    expect(result.trend.at(-1)).toMatchObject({
      from: '2026-10-26',
      value: 0.3,
      count: 1,
      partial: true,
    });
    expect(result.trend.at(-2)?.value).toBe(0.2);
    expect(result.trend[0]?.value).toBe(0);
    expect(result.trend.at(-1)?.label).toBe('26 Okt');
  });
  it('switches day and month grouping, including year changes and empty periods', () => {
    const source = createSeed().requests[0]!;
    const daily = trendAnalytics(
      [{ ...source, createdAt: '2026-10-26T00:00:00Z' }],
      { from: '2026-10-24', to: '2026-10-26' },
      now,
    );
    expect(daily.unit).toBe('day');
    expect(daily.trend.map((point) => point.count)).toEqual([0, 0, 1]);
    const monthly = trendAnalytics(
      [{ ...source, createdAt: '2026-12-31T17:00:00Z' }],
      { from: '2026-06-15', to: '2027-02-10' },
      new Date('2027-02-10T12:00:00Z'),
    );
    expect(monthly.unit).toBe('month');
    expect(monthly.trend.find((point) => point.label === 'Jan 2027')?.count).toBe(1);
    expect(monthly.trend[0]?.partial).toBe(true);
    expect(monthly.trend.at(-1)?.partial).toBe(true);
    expect(
      trendAnalytics([], lastEightWeeks(now), now).trend.every((point) => point.value === 0),
    ).toBe(true);
  });
  it('prioritizes active requests by deadline then amount without moving overlapping points', () => {
    const data = createSeed();
    const source = data.requests[0]!;
    data.requests = [
      { ...source, id: 'a', requiredDate: '2026-10-25' },
      { ...source, id: 'b', requiredDate: '2026-10-29', unitPrice: '100' },
      { ...source, id: 'c', requiredDate: '2026-10-29', unitPrice: '200' },
      { ...source, id: 'd', requiredDate: '2026-10-30' },
      { ...source, id: 'e', requiredDate: '2026-11-02' },
      { ...source, id: 'f', requiredDate: '2026-11-03' },
      { ...source, id: 'closed', status: 'delivered' },
      { ...source, id: 'deleted', deleted: true },
    ];
    const points = urgencyAnalytics(data, '', now);
    expect(points.map((point) => point.id)).toEqual(['a', 'c', 'b', 'd', 'e', 'f']);
    expect(points.map((point) => point.group)).toEqual([
      'late',
      'urgent',
      'urgent',
      'soon',
      'soon',
      'planned',
    ]);
    expect(points[1]?.days).toBe(points[2]?.days);
    expect(urgencyAnalytics(data, 'weather', now)).toEqual([]);
  });
  it('ranks only owned active requests by age and supports status filtering', () => {
    const data = createSeed(now);
    const source = data.requests[0]!;
    const user = data.users.find((person) => person.id === 'demo-pengaju')!;
    data.requests = [
      { ...source, id: 'recent', createdAt: '2026-10-25T17:00:00Z' },
      { ...source, id: 'old', createdAt: '2026-10-20T16:59:59Z', status: 'ordered' },
      { ...source, id: 'other', ownerId: 'hasan' },
      { ...source, id: 'done', status: 'delivered' },
      { ...source, id: 'deleted', deleted: true },
    ];
    expect(personalFollowup(data, user, '', now).map((row) => [row.id, row.age])).toEqual([
      ['old', 6],
      ['recent', 0],
    ]);
    expect(personalFollowup(data, user, 'ordered', now).map((row) => row.id)).toEqual(['old']);
  });
  it('counts receipts once from recorded dates, zero-fills weeks, and excludes other users', () => {
    const data = createSeed(now);
    const source = data.requests[0]!;
    const user = data.users.find((person) => person.id === 'demo-pengaju')!;
    const received = {
      from: 'in_transit' as const,
      to: 'delivered' as const,
      actorId: 'demo-admin',
      at: '2026-10-25T17:00:00Z',
      reason: '',
    };
    data.requests = [
      {
        ...source,
        id: 'received',
        status: 'completed',
        createdAt: '2026-10-19T08:00:00Z',
        statusHistory: [received, received],
      },
      { ...source, id: 'legacy', status: 'delivered', statusHistory: [] },
      { ...source, id: 'other', ownerId: 'hasan', statusHistory: [received] },
      { ...source, id: 'deleted', deleted: true, statusHistory: [received] },
    ];
    const result = personalReceiptTrend(data, user, 4, now);
    expect(result.buckets).toHaveLength(4);
    expect(result.buckets[0]?.submissions).toBe(0);
    expect(result.buckets.at(-1)).toMatchObject({
      from: '2026-10-26',
      to: '2026-10-26',
      receipts: 1,
      partial: true,
    });
    expect(result.buckets.flatMap((bucket) => bucket.received.map((row) => row.id))).toEqual([
      'received',
    ]);
    expect(result.missingReceiptDates).toBe(1);
    expect(
      personalReceiptTrend({ ...data, requests: [] }, user, 8, now).buckets.every(
        (bucket) => bucket.submissions === 0 && bucket.receipts === 0,
      ),
    ).toBe(true);
  });
  it('redirects old URLs while preserving filters and RAB source', () => {
    const target = new URL(
      legacyDestination('/requests', '?q=sensor&page=2&create=1&sourceRab=abc&sourceItem=xyz')!,
      'https://example.test',
    );
    expect(target.pathname).toBe('/requests/new');
    expect(target.searchParams.get('sourceRab')).toBe('abc');
    expect(target.searchParams.get('returnTo')).toBe('/requests?q=sensor&page=2');
    expect(legacyDestination('/dashboard', '?detail=request-1')).toContain('/requests/request-1?');
    expect(legacyDestination('/requests', '?tab=rab&rab=version-1')).toContain(
      '/requests/rab/version-1',
    );
    expect(legacyDestination('/requests', '?q=barang')).toBeNull();
  });
});
