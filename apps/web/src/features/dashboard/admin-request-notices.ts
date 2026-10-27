import type { DemoSnapshot, DemoUser } from '../demo/model';

export function adminRequestNotices(data: DemoSnapshot, user: DemoUser) {
  if (user.role !== 'admin') return [];
  return data.requests
    .filter((request) => !request.deleted && request.status === 'pending_review')
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
