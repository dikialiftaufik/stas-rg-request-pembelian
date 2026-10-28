import type { DemoSnapshot } from './model';
import { createSeed } from './seed';

export function upgradeDemo(data: DemoSnapshot): DemoSnapshot {
  if (data.demoRevision >= 1) return data;
  const fresh = createSeed();
  const originalOwners = ['demo-pengaju', 'hasan', 'budi', 'siti', 'demo-pengaju', 'ahmadi'];
  const originalPrices = ['12500000', '8900000', '3200000', '7500000', '1800000'];
  const users = data.users.map((user) => ({
    ...user,
    researchIds:
      user.id === 'budi' && user.researchIds.length === 1 && user.researchIds[0] === 'smart'
        ? ['weather']
        : user.role === 'pengaju'
          ? user.researchIds.slice(0, 1)
          : user.researchIds,
  }));
  const extra = fresh.users.find((user) => user.id === 'eka');
  if (
    extra &&
    data.research.some((item) => item.id === 'farming') &&
    !users.some((user) => user.id === extra.id)
  )
    users.push(extra);
  // Upgrade only untouched legacy fixtures; user edits and historical purchases stay intact.
  const requests = data.requests.map((request) => {
    const index = Number(request.id.replace('request-', '')) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= fresh.requests.length) return request;
    const replacement = fresh.requests.at(index);
    const researchId = fresh.research[index % fresh.research.length]?.id;
    const originalStatus = [0, 4, 5, 6].includes(index)
      ? 'pending_review'
      : [1, 7].includes(index)
        ? 'ordered'
        : 'approved';
    const untouched =
      replacement &&
      request.item === replacement.item &&
      request.createdAt === new Date(Date.UTC(2026, 9, 26 - index, 8)).toISOString() &&
      request.ownerId === originalOwners.at(index % originalOwners.length) &&
      request.researchId === researchId &&
      request.status === originalStatus &&
      request.submissionStatus === 'not_submitted' &&
      !request.replacements.length &&
      request.revision === 0 &&
      request.unitPrice === (originalPrices.at(index) ?? (index === 23 ? '10500000' : '4500000')) &&
      request.quantity === 1 &&
      request.unit === 'unit' &&
      request.url === '' &&
      request.requiredDate === '2026-11-12' &&
      request.notes === 'Data contoh untuk demonstrasi frontend.' &&
      !request.deleted &&
      !request.invoice &&
      !request.fulfillment &&
      !request.rabDocumentId &&
      !request.rabItemId &&
      !request.statusHistory.length;
    return untouched &&
      users.some((user) => user.id === replacement.ownerId) &&
      data.research.some((item) => item.id === replacement.researchId)
      ? replacement
      : request;
  });
  return {
    ...data,
    demoRevision: 1,
    users,
    requests,
    notifications: data.notifications.map((notice) =>
      notice.id === 'notice-5' &&
      notice.message === 'Pengajuan pH Meter Digital menunggu persetujuan.'
        ? {
            ...notice,
            requestId: 'request-7',
            message: 'Pengajuan Modul Akuisisi Data menunggu persetujuan.',
          }
        : notice,
    ),
    rabDocuments: [
      ...data.rabDocuments,
      ...fresh.rabDocuments.filter(
        (doc) =>
          data.research.some((item) => item.id === doc.researchId) &&
          !data.rabDocuments.some((existing) => existing.researchId === doc.researchId),
      ),
    ],
  };
}
