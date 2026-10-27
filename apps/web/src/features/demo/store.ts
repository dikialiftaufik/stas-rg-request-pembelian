import {
  snapshotSchema,
  userInputSchema,
  researchInputSchema,
  requestInputSchema,
  requestTotal,
  researchUsed,
  validateRequestDate,
  statusSchema,
  statusLabelMap,
  invoiceSchema,
  invoiceInputSchema,
} from './model';
import type {
  DemoSnapshot,
  DemoUser,
  RequestInput,
  UserInput,
  ResearchInput,
  RequestStatus,
  AttachmentRef,
} from './model';
import { createSeed, demoAccounts } from './seed';
import { allowedNextStatuses } from './request-workflow';
import { getAttachment, putAttachment, removeAttachment } from './attachment-db';
import { validateFile } from './file-validation';

export const DEMO_STORAGE_KEY = 'stas-rg-demo-v1';
let snapshot: DemoSnapshot | undefined;
const listeners = new Set<() => void>();

export function getSnapshot(): DemoSnapshot {
  if (!snapshot) {
    try {
      const saved = sessionStorage.getItem(DEMO_STORAGE_KEY);
      snapshot = saved ? snapshotSchema.parse(JSON.parse(saved) as unknown) : createSeed();
    } catch {
      snapshot = createSeed();
    }
  }
  return snapshot;
}

function publish(next: DemoSnapshot, strict = false) {
  if (strict) {
    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snapshotSchema.parse(next)));
    } catch {
      throw new Error(
        'Data gagal disimpan. Periksa ruang dan izin penyimpanan browser lalu coba lagi.',
      );
    }
  }
  snapshot = next;
  try {
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Restricted storage falls back to memory for this page. */
  }
  listeners.forEach((listener) => listener());
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function resetDemoState() {
  publish(createSeed());
}
export function reloadDemoState() {
  snapshot = undefined;
  listeners.forEach((listener) => listener());
}

export function currentUser(data = getSnapshot()): DemoUser | null {
  const account = demoAccounts.find((item) => item.id === data.accountId);
  const user = data.users.find((item) => item.id === account?.id);
  return account && user ? { ...user, email: account.email, role: account.role } : null;
}
export function loginDemo(email: string, password: string) {
  const account = demoAccounts.find(
    (item) => item.email === email.trim().toLowerCase() && item.password === password,
  );
  if (!account) return false;
  publish({ ...getSnapshot(), accountId: account.id, adminNoticeSeen: false });
  return true;
}
export function logoutDemo() {
  publish({ ...getSnapshot(), accountId: null, adminNoticeSeen: false });
}
function requireUser(adminOnly = false) {
  const user = currentUser();
  if (!user || (adminOnly && user.role !== 'admin'))
    throw new Error('Anda tidak memiliki akses untuk tindakan ini.');
  return user;
}
export function scopedRequests(data: DemoSnapshot, user: DemoUser) {
  return data.requests.filter(
    (item) => !item.deleted && (user.role === 'admin' || item.ownerId === user.id),
  );
}
export function visibleRequest(id: string) {
  const user = requireUser();
  const request = scopedRequests(getSnapshot(), user).find((item) => item.id === id);
  if (!request) throw new Error('Request tidak ditemukan atau tidak dapat diakses.');
  return request;
}
function notification(data: DemoSnapshot, recipientId: string, requestId: string, message: string) {
  return {
    ...data,
    notifications: [
      {
        id: crypto.randomUUID(),
        recipientId,
        requestId,
        message,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...data.notifications,
    ],
  };
}

export function saveRequest(input: RequestInput, id?: string) {
  const user = requireUser(Boolean(id));
  if (!id && user.role !== 'pengaju') throw new Error('Pembuatan request tersedia untuk Pengaju.');
  const values = requestInputSchema.parse(input);
  const data = getSnapshot();
  const existing = id ? visibleRequest(id) : undefined;
  const research = data.research.find((item) => item.id === values.researchId);
  if (!research || (user.role === 'pengaju' && !user.researchIds.includes(research.id)))
    throw new Error('Jenis riset tidak dapat digunakan.');
  if (
    (!existing || existing.requiredDate !== values.requiredDate) &&
    !validateRequestDate(values.requiredDate)
  )
    throw new Error('Tanggal kebutuhan harus H-3 hari kerja sampai maksimal 180 hari ke depan.');
  const request = existing
    ? { ...existing, ...values }
    : {
        ...values,
        id: crypto.randomUUID(),
        ownerId: user.id,
        status: 'pending_review' as const,
        createdAt: new Date().toISOString(),
        deleted: false,
        statusHistory: [],
        invoice: null,
        fulfillment: null,
        rabDocumentId: null,
        rabItemId: null,
      };
  let next = {
    ...data,
    requests: existing
      ? data.requests.map((item) => (item.id === id ? request : item))
      : [request, ...data.requests],
  };
  if (next.research.some((item) => researchUsed(next, item.id).gt(item.allocated)))
    throw new Error('Perubahan melebihi alokasi dana riset.');
  next = notification(
    next,
    existing ? request.ownerId : 'demo-admin',
    request.id,
    `${request.item} ${existing ? 'diperbarui oleh Admin.' : 'menunggu persetujuan.'}`,
  );
  publish(next);
  return request.id;
}
export function deleteRequest(id: string) {
  requireUser(true);
  const request = visibleRequest(id);
  const data = getSnapshot();
  publish(
    notification(
      {
        ...data,
        requests: data.requests.map((item) => (item.id === id ? { ...item, deleted: true } : item)),
      },
      request.ownerId,
      id,
      `${request.item} dihapus dari daftar oleh Admin.`,
    ),
  );
}
export function cancelRequest(id: string) {
  const user = requireUser();
  const request = visibleRequest(id);
  if (user.role !== 'pengaju' || request.ownerId !== user.id || request.status !== 'pending_review')
    throw new Error('Hanya request sendiri yang menunggu persetujuan yang dapat dibatalkan.');
  const data = getSnapshot();
  publish(
    notification(
      {
        ...data,
        requests: data.requests.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'cancelled' as const,
                statusHistory: [
                  ...item.statusHistory,
                  {
                    from: item.status,
                    to: 'cancelled' as const,
                    actorId: user.id,
                    at: new Date().toISOString(),
                    reason: 'Dibatalkan oleh Pengaju.',
                  },
                ],
              }
            : item,
        ),
      },
      'demo-admin',
      id,
      `${request.item} dibatalkan oleh Pengaju.`,
    ),
  );
}
export function saveUser(input: UserInput, id?: string) {
  requireUser(true);
  const values = userInputSchema.parse(input);
  const data = getSnapshot();
  const existing = id ? data.users.find((item) => item.id === id) : undefined;
  if (id && !existing) throw new Error('Pengguna tidak ditemukan.');
  const account = demoAccounts.find((item) => item.id === id);
  if (account && (account.email !== values.email || account.role !== values.role))
    throw new Error('Email dan peran akun demo utama tidak dapat diubah.');
  if (
    data.users.some(
      (item) =>
        item.id !== id &&
        (item.email.toLowerCase() === values.email ||
          item.identifier.toLowerCase() === values.identifier.toLowerCase()),
    )
  )
    throw new Error('Email atau NIP/NIM sudah digunakan.');
  if (
    values.researchIds.some((researchId) => !data.research.some((item) => item.id === researchId))
  )
    throw new Error('Jenis riset tidak ditemukan.');
  const user = existing
    ? { ...existing, ...values }
    : { ...values, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  publish({
    ...data,
    users: existing
      ? data.users.map((item) => (item.id === id ? user : item))
      : [...data.users, user],
  });
  return user.id;
}
export function deleteUser(id: string) {
  requireUser(true);
  const data = getSnapshot();
  if (demoAccounts.some((item) => item.id === id))
    throw new Error('Akun demo utama tidak dapat dihapus.');
  if (data.requests.some((item) => item.ownerId === id))
    throw new Error('Pengguna masih dirujuk oleh request dan tidak dapat dihapus.');
  publish({ ...data, users: data.users.filter((item) => item.id !== id) });
}
export function saveResearch(input: ResearchInput, id?: string) {
  requireUser(true);
  const values = researchInputSchema.parse(input);
  const data = getSnapshot();
  if (id && !data.research.some((item) => item.id === id))
    throw new Error('Jenis riset tidak ditemukan.');
  if (
    data.research.some(
      (item) => item.id !== id && item.name.toLowerCase() === values.name.toLowerCase(),
    )
  )
    throw new Error('Nama jenis riset sudah digunakan.');
  if (id && researchUsed(data, id).gt(values.allocated))
    throw new Error('Alokasi tidak boleh lebih kecil daripada dana yang digunakan.');
  const research = { ...values, id: id ?? crypto.randomUUID() };
  publish({
    ...data,
    research: id
      ? data.research.map((item) => (item.id === id ? research : item))
      : [...data.research, research],
  });
  return research.id;
}
export function deleteResearch(id: string) {
  requireUser(true);
  const data = getSnapshot();
  if (data.requests.some((item) => item.researchId === id))
    throw new Error('Jenis riset masih dirujuk oleh request dan tidak dapat dihapus.');
  if (data.users.some((item) => item.researchIds.includes(id)))
    throw new Error('Jenis riset masih memiliki perwakilan pengguna.');
  publish({ ...data, research: data.research.filter((item) => item.id !== id) });
}
export function markNotificationsRead(ids?: string[]) {
  const user = requireUser();
  const data = getSnapshot();
  publish({
    ...data,
    notifications: data.notifications.map((item) =>
      item.recipientId === user.id && (!ids || ids.includes(item.id))
        ? { ...item, read: true }
        : item,
    ),
  });
}
export function dashboardSummary(data: DemoSnapshot, user: DemoUser) {
  const requests = scopedRequests(data, user);
  return {
    total: requests.length,
    approved: requests.filter((item) => item.status === 'approved').length,
    pending: requests.filter((item) => item.status === 'pending_review').length,
    value: requests.reduce(
      (sum, item) => sum.plus(requestTotal(item)),
      requestTotal({ quantity: 0, unitPrice: '0' }),
    ),
  };
}

export async function changeRequestStatus(input: {
  id: string;
  expectedStatus: RequestStatus;
  nextStatus: RequestStatus;
  reason?: string;
}) {
  const user = requireUser(true);
  let request = visibleRequest(input.id);
  if (input.nextStatus === 'completed') {
    if (
      !request.invoice ||
      !invoiceSchema.safeParse(request.invoice).success ||
      !invoiceInputSchema.safeParse(request.invoice).success
    )
      throw new Error('Lengkapi invoice sebelum menyelesaikan Pembelian Barang.');
    const invoiceVersion = request.invoice.updatedAt;
    if (request.invoice.file) await getAttachment(request.invoice.file);
    request = visibleRequest(input.id);
    if (request.invoice?.updatedAt !== invoiceVersion)
      throw new Error('Invoice berubah. Periksa invoice terbaru sebelum menyelesaikan request.');
    if (requireUser(true).id !== user.id)
      throw new Error('Sesi berubah. Buka kembali request untuk melanjutkan.');
  }
  const nextStatus = statusSchema.parse(input.nextStatus);
  if (request.status !== input.expectedStatus)
    throw new Error(
      'Status sudah berubah. Tutup lalu buka kembali form untuk melihat status terbaru.',
    );
  if (!allowedNextStatuses(request.status).includes(nextStatus))
    throw new Error('Perubahan status tidak diizinkan. Pilih tahapan berikutnya yang tersedia.');
  if (input.nextStatus === 'completed' && !request.invoice)
    throw new Error('Lengkapi invoice sebelum menyelesaikan Pembelian Barang.');
  const reason = input.reason?.trim() ?? '';
  if (nextStatus === 'rejected' && !reason)
    throw new Error('Jelaskan alasan penolakan agar Pengaju dapat menindaklanjuti.');
  const updated = {
    ...request,
    status: nextStatus,
    statusHistory: [
      ...request.statusHistory,
      {
        from: request.status,
        to: nextStatus,
        actorId: user.id,
        at: new Date().toISOString(),
        reason,
      },
    ],
  };
  const data = getSnapshot();
  const next = {
    ...data,
    requests: data.requests.map((item) => (item.id === request.id ? updated : item)),
  };
  const research = data.research.find((item) => item.id === request.researchId);
  if (!research || researchUsed(next, research.id).gt(research.allocated))
    throw new Error(
      'Alokasi dana riset tidak mencukupi. Periksa alokasi sebelum menyetujui request.',
    );
  publish(
    notification(
      next,
      request.ownerId,
      request.id,
      `${request.item}: ${statusLabelMap.get(nextStatus)}.${reason ? ` ${reason}` : ''}`,
    ),
  );
}
export function consumeAdminNotice() {
  requireUser(true);
  if (!getSnapshot().adminNoticeSeen) publish({ ...getSnapshot(), adminNoticeSeen: true });
}

export function canManageInvoice(status: RequestStatus) {
  return ['approved', 'ordered', 'in_transit', 'delivered', 'completed'].includes(status);
}

export async function loadInvoiceFile(requestId: string) {
  const request = visibleRequest(requestId);
  if (!request.invoice?.file) throw new Error('Invoice belum memiliki file.');
  const blob = await getAttachment(request.invoice.file);
  visibleRequest(requestId);
  return blob;
}

export async function saveInvoice(input: {
  requestId: string;
  file?: File | undefined;
  url: string;
  expectedUpdatedAt: string | null;
  amount: string;
  invoiceDate: string;
}) {
  const actor = requireUser(true);
  const original = visibleRequest(input.requestId);
  if (!canManageInvoice(original.status))
    throw new Error('Invoice dapat ditambahkan setelah request disetujui.');
  const metadata = invoiceInputSchema.safeParse(input);
  if (!metadata.success)
    throw new Error(metadata.error.issues[0]?.message ?? 'Lengkapi nominal dan tanggal invoice.');
  let stored: AttachmentRef | null = null;
  try {
    if (input.file)
      stored = await putAttachment(input.file, await validateFile(input.file, 'invoice'), actor.id);
    const user = requireUser(true);
    const request = visibleRequest(input.requestId);
    if (user.id !== actor.id || !canManageInvoice(request.status))
      throw new Error('Sesi atau status berubah. Buka kembali request.');
    if ((request.invoice?.updatedAt ?? null) !== input.expectedUpdatedAt)
      throw new Error('Invoice sudah berubah. Buka kembali dokumen terbaru.');
    const parsedInvoice = invoiceSchema.safeParse({
      ...metadata.data,
      file: stored ?? request.invoice?.file ?? null,
      url: input.url,
      updatedAt: new Date(
        Math.max(Date.now(), request.invoice ? Date.parse(request.invoice.updatedAt) + 1 : 0),
      ).toISOString(),
      updatedBy: user.id,
    });
    if (!parsedInvoice.success)
      throw new Error(
        parsedInvoice.error.issues[0]?.message ?? 'Periksa file atau tautan invoice.',
      );
    const invoice = parsedInvoice.data;
    const data = getSnapshot();
    publish(
      notification(
        {
          ...data,
          requests: data.requests.map((item) =>
            item.id === request.id ? { ...item, invoice } : item,
          ),
        },
        request.ownerId,
        request.id,
        `Invoice ${request.item} tersedia untuk dilihat.`,
      ),
      true,
    );
    if (stored && request.invoice?.file)
      void removeAttachment(request.invoice.file).catch(() => {
        /* A failed cleanup must not undo a committed invoice. */
      });
  } catch (cause) {
    if (stored) await removeAttachment(stored).catch(() => undefined);
    throw cause;
  }
}
