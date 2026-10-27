import type { DemoRequest, DemoSnapshot, DemoUser } from '../demo/model';
import { requestTotal, statusLabelMap, submissionStatusLabels } from '../demo/model';

export type SortDirection = 'asc' | 'desc';
export const requestColumns = [
  'item',
  'owner',
  'research',
  'quantity',
  'total',
  'status',
  'submissionStatus',
  'createdAt',
  'invoice',
  'invoiceNumber',
] as const;
export const userColumns = [
  'name',
  'identifier',
  'email',
  'role',
  'research',
  'createdAt',
] as const;
export type RequestSortKey = (typeof requestColumns)[number];
export type UserSortKey = (typeof userColumns)[number];
export const collator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });

export function readSort<T extends string>(
  params: URLSearchParams,
  keys: readonly T[],
  fallback: T,
  direction: SortDirection,
  legacyTotal = false,
) {
  const requested = params.get('sortBy');
  const key = keys.find((key) => key === requested);
  if (key)
    return {
      key,
      direction: params.get('sortDir') === 'desc' ? ('desc' as const) : ('asc' as const),
    };
  if (legacyTotal && ['asc', 'desc'].includes(params.get('sort') ?? '')) {
    return {
      key: keys.find((key) => key === 'total') ?? fallback,
      direction: params.get('sort') === 'asc' ? ('asc' as const) : ('desc' as const),
    };
  }
  return { key: fallback, direction };
}
export function sortParams(
  params: URLSearchParams,
  key: string,
  active: string,
  direction: SortDirection,
) {
  const next = new URLSearchParams(params);
  next.set('sortBy', key);
  next.set('sortDir', active === key && direction === 'asc' ? 'desc' : 'asc');
  next.delete('sort');
  next.delete('page');
  return next;
}
export function representedResearch(user: DemoUser, data: DemoSnapshot) {
  return user.researchIds
    .map((id) => data.research.find((item) => item.id === id)?.name ?? '')
    .toSorted(collator.compare);
}
export function sortRequests(
  rows: DemoRequest[],
  data: DemoSnapshot,
  key: RequestSortKey,
  direction: SortDirection,
) {
  const users = new Map(data.users.map((user) => [user.id, user.name]));
  const research = new Map(data.research.map((item) => [item.id, item.name]));
  const text = (row: DemoRequest): string => {
    switch (key) {
      case 'item':
        return row.item;
      case 'owner':
        return users.get(row.ownerId) ?? '';
      case 'research':
        return research.get(row.researchId) ?? '';
      case 'invoice':
        return row.invoice?.file?.name ?? row.invoice?.url ?? '';
      case 'invoiceNumber':
        return row.invoice?.number ?? '';
      case 'submissionStatus':
        return submissionStatusLabels[row.submissionStatus];
      case 'status':
        return statusLabelMap.get(row.status) ?? '';
      default:
        return row.createdAt;
    }
  };
  return rows.toSorted((a, b) => {
    const comparison =
      key === 'quantity'
        ? a.quantity - b.quantity
        : key === 'total'
          ? requestTotal(a).cmp(requestTotal(b))
          : key === 'createdAt'
            ? a.createdAt.localeCompare(b.createdAt)
            : collator.compare(text(a), text(b));
    return comparison * (direction === 'asc' ? 1 : -1) || collator.compare(a.id, b.id);
  });
}
export function sortUsers(
  rows: DemoUser[],
  data: DemoSnapshot,
  key: UserSortKey,
  direction: SortDirection,
) {
  const value = (user: DemoUser) => {
    switch (key) {
      case 'name':
        return user.name;
      case 'identifier':
        return user.identifier;
      case 'email':
        return user.email;
      case 'role':
        return user.role === 'admin' ? 'Admin' : 'Pengaju';
      case 'research':
        return representedResearch(user, data).join(', ');
      case 'createdAt':
        return user.createdAt;
    }
  };
  return rows.toSorted(
    (a, b) =>
      (key === 'createdAt'
        ? a.createdAt.localeCompare(b.createdAt)
        : collator.compare(value(a), value(b))) * (direction === 'asc' ? 1 : -1) ||
      collator.compare(a.id, b.id),
  );
}
