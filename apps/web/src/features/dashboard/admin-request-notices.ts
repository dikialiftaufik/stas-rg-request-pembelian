import type { DemoSnapshot, DemoUser } from '../demo/model';

/** Outstanding approvals remain actionable even after a bell notification is read. */
export function adminRequestNotices(data: DemoSnapshot, user: DemoUser) {
  if (user.role !== 'admin') return [];
  const pending = data.requests.filter(
    (request) => !request.deleted && request.status === 'pending_review',
  );
  const byId = new Map(pending.map((request) => [request.id, request]));
  const seen = new Set<string>();
  const notices = data.notifications
    .filter((notice) => notice.recipientId === user.id)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((notice) => {
      const request = byId.get(notice.requestId);
      if (!request || seen.has(request.id)) return [];
      seen.add(request.id);
      return [request];
    });
  return notices.length
    ? notices
    : pending.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}
