import Decimal from 'decimal.js';
import type { DemoRequest, DemoSnapshot, DemoUser, RequestStatus } from '../demo/model';
import { requestTotal } from '../demo/model';
import { scopedRequests } from '../demo/store';
import { shiftDay, wibDay } from './date-range';
import type { DateRangeValue } from './date-range';
export const activeStatuses: readonly RequestStatus[] = [
  'pending_review',
  'approved',
  'ordered',
  'in_transit',
];
export const urgencyGroups = [
  { key: 'late', label: 'Terlambat', shape: 'triangle', color: 'var(--ui-danger)' },
  { key: 'urgent', label: '0–3 hari', shape: 'diamond', color: 'var(--ui-chart-urgent)' },
  { key: 'soon', label: '4–7 hari', shape: 'square', color: 'var(--ui-chart-soon)' },
  { key: 'planned', label: 'Lebih dari 7 hari', shape: 'circle', color: 'var(--ui-primary)' },
] as const;
export function dayDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
export function mondayOf(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDay(day, -(weekday === 0 ? 6 : weekday - 1));
}
export function lastEightWeeks(now = new Date()): DateRangeValue {
  const today = wibDay(now);
  return { from: shiftDay(mondayOf(today), -49), to: today };
}
export function shortDate(day: string, monthOnly = false) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    ...(monthOnly
      ? ({ month: 'short', year: 'numeric' } as const)
      : ({ day: 'numeric', month: 'short' } as const)),
  }).format(new Date(`${day}T12:00:00+07:00`));
}
function nextMonth(day: string) {
  const value = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
}
export function trendAnalytics(requests: DemoRequest[], range: DateRangeValue, now = new Date()) {
  const length = dayDifference(range.from, range.to) + 1;
  const unit = length <= 31 ? 'day' : length <= 180 ? 'week' : 'month';
  const today = wibDay(now);
  const rows = requests.filter(
    (request) =>
      !request.deleted &&
      wibDay(request.createdAt) >= range.from &&
      wibDay(request.createdAt) <= range.to &&
      wibDay(request.createdAt) <= today,
  );
  let cursor =
    unit === 'day'
      ? range.from
      : unit === 'week'
        ? mondayOf(range.from)
        : `${range.from.slice(0, 7)}-01`;
  const trend = [];
  while (cursor <= range.to) {
    const end =
      unit === 'day'
        ? cursor
        : unit === 'week'
          ? shiftDay(cursor, 6)
          : shiftDay(nextMonth(cursor), -1);
    const from = cursor < range.from ? range.from : cursor;
    const to = end > range.to ? range.to : end;
    const bucket = rows.filter(
      (request) => wibDay(request.createdAt) >= from && wibDay(request.createdAt) <= to,
    );
    trend.push({
      start: cursor,
      from,
      to,
      label: shortDate(from, unit === 'month'),
      partial: cursor < range.from || end > range.to || end > today,
      value: bucket
        .reduce((sum, request) => sum.plus(requestTotal(request)), new Decimal(0))
        .toNumber(),
      count: bucket.length,
    });
    cursor = unit === 'month' ? nextMonth(cursor) : shiftDay(cursor, unit === 'week' ? 7 : 1);
  }
  return { trend, unit };
}
export function urgencyAnalytics(data: DemoSnapshot, researchId = '', now = new Date()) {
  const today = wibDay(now);
  return data.requests
    .filter(
      (request) =>
        !request.deleted &&
        activeStatuses.includes(request.status) &&
        (!researchId || request.researchId === researchId),
    )
    .map((request) => {
      const days = dayDifference(today, request.requiredDate);
      return {
        id: request.id,
        item: request.item,
        owner: data.users.find((person) => person.id === request.ownerId)?.name ?? '',
        research: data.research.find((item) => item.id === request.researchId)?.name ?? '',
        status: request.status,
        date: request.requiredDate,
        days,
        value: requestTotal(request).toNumber(),
        group: days < 0 ? 'late' : days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'planned',
      };
    })
    .toSorted(
      (a, b) => a.days - b.days || new Decimal(b.value).cmp(a.value) || a.id.localeCompare(b.id),
    );
}
export type UrgencyPoint = ReturnType<typeof urgencyAnalytics>[number];
export function personalAgenda(
  data: DemoSnapshot,
  user: DemoUser,
  weeks: number,
  now = new Date(),
) {
  const today = wibDay(now);
  const monday = mondayOf(today);
  const requests = scopedRequests(data, user).filter((request) =>
    activeStatuses.includes(request.status),
  );
  const definitions = [
    { key: 'overdue', label: 'Terlambat', from: '', to: shiftDay(today, -1) },
    ...Array.from({ length: weeks }, (_, index) => {
      const start = shiftDay(monday, index * 7);
      return {
        key: start,
        label: shortDate(start < today ? today : start),
        from: start < today ? today : start,
        to: shiftDay(start, 6),
      };
    }),
  ];
  const buckets = definitions.map((bucket) => {
    const rows = requests.filter(
      (request) => request.requiredDate >= bucket.from && request.requiredDate <= bucket.to,
    );
    return {
      ...bucket,
      requests: rows,
      pending_review: rows.filter((row) => row.status === 'pending_review').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      ordered: rows.filter((row) => row.status === 'ordered').length,
      in_transit: rows.filter((row) => row.status === 'in_transit').length,
      value: rows.reduce((sum, row) => sum.plus(requestTotal(row)), new Decimal(0)).toNumber(),
    };
  });
  const end = definitions.at(-1)?.to ?? today;
  return { buckets, outside: requests.filter((request) => request.requiredDate > end).length };
}
