import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { snapshotSchema, requestDateLimits, userInputSchema } from './model';
import { urgencyAnalytics } from '../dashboard/analytics';
import { demoRabCsv } from './demo-rab';
import { upgradeDemo } from './upgrade-demo';
import {
  currentUser,
  getSnapshot,
  loadRabFile,
  loginDemo,
  saveRequest,
  scopedRabs,
  visibleRab,
} from './store';

describe('representative purchase flow and demo catalogue', () => {
  it('seeds consistent representatives, readable RAB sources and all urgency groups', async () => {
    const now = new Date('2026-10-27T02:00:00Z');
    const data = snapshotSchema.parse(createSeed(now));
    expect(
      data.users
        .filter((user) => user.role === 'pengaju')
        .every((user) => user.researchIds.length === 1),
    ).toBe(true);
    expect(
      data.requests.every((request) =>
        data.users
          .find((user) => user.id === request.ownerId)
          ?.researchIds.includes(request.researchId),
      ),
    ).toBe(true);
    expect(new Set(urgencyAnalytics(data, 'smart', now).map((point) => point.group))).toEqual(
      new Set(['late', 'urgent', 'soon', 'planned']),
    );
    loginDemo('pengaju@gmail.com', 'pengaju123');
    const user = currentUser()!;
    const docs = scopedRabs(getSnapshot(), user);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.researchId).toBe('smart');
    const doc = docs[0]!;
    const blob = await loadRabFile(doc.id);
    expect(blob.size).toBe(doc.source.size);
    expect(blob.type).toBe('text/csv');
    expect(demoRabCsv(doc.items)).toContain('Sensor tekanan FSR');
    expect(() => visibleRab('demo-rab-weather')).toThrow(/tidak dapat diakses/);
  });
  it('rejects research substitution and RAB identity tampering without writes', () => {
    loginDemo('pengaju@gmail.com', 'pengaju123');
    const doc = visibleRab('demo-rab-smart');
    const item = doc.items[0]!;
    const input = {
      item: item.name,
      unit: item.unit,
      quantity: 1,
      unitPrice: item.unitPrice,
      researchId: 'smart',
      requiredDate: requestDateLimits().minimum,
      notes: '',
      url: '',
    };
    const before = JSON.stringify(getSnapshot());
    expect(() => saveRequest({ ...input, researchId: 'weather' })).toThrow(/perwakilan/);
    expect(() =>
      saveRequest({ ...input, item: 'Barang palsu' }, undefined, {
        documentId: doc.id,
        itemId: item.id,
      }),
    ).toThrow(/Nama dan satuan/);
    expect(JSON.stringify(getSnapshot())).toBe(before);
    const id = saveRequest(input, undefined, { documentId: doc.id, itemId: item.id });
    expect(getSnapshot().requests.find((row) => row.id === id)).toMatchObject({
      researchId: 'smart',
      ownerId: 'demo-pengaju',
      rabDocumentId: doc.id,
      rabItemId: item.id,
    });
    const user = currentUser()!;
    expect(userInputSchema.safeParse({ ...user, researchIds: ['smart', 'lake'] }).success).toBe(
      false,
    );
  });
  it('upgrades legacy data once while preserving edits, imported documents and session', () => {
    const data = createSeed();
    data.demoRevision = 0;
    data.accountId = 'demo-pengaju';
    data.adminNoticeSeen = true;
    data.users.find((user) => user.id === 'demo-pengaju')!.researchIds = ['smart', 'lake'];
    for (let index = 0; index < 4; index++) {
      const request = data.requests.at(index)!;
      request.createdAt = new Date(Date.UTC(2026, 9, 26 - index, 8)).toISOString();
      request.requiredDate = '2026-11-12';
      request.ownerId = ['demo-pengaju', 'hasan', 'budi', 'siti'].at(index)!;
      request.statusHistory = [];
    }
    data.requests[0]!.notes = 'User change';
    data.requests[1]!.url = 'https://example.test/user-change';
    data.requests[2]!.unit = 'set';
    data.requests.push({ ...data.requests[0]!, id: 'custom-request' });
    const document = data.rabDocuments[0]!;
    document.id = 'uploaded-by-admin';
    document.sourceKind = 'upload';
    data.rabDocuments = [document];
    const result = snapshotSchema.parse(upgradeDemo(data));
    expect(result).toMatchObject({
      accountId: 'demo-pengaju',
      adminNoticeSeen: true,
      demoRevision: 1,
    });
    expect(result.requests[0]?.notes).toBe('User change');
    expect(result.requests[1]?.url).toBe('https://example.test/user-change');
    expect(result.requests[2]?.unit).toBe('set');
    expect(result.requests[3]?.createdAt).not.toBe('2026-10-23T08:00:00.000Z');
    expect(result.requests.some((request) => request.id === 'custom-request')).toBe(true);
    expect(result.rabDocuments.filter((doc) => doc.researchId === 'smart')).toEqual([document]);
    expect(result.rabDocuments).toHaveLength(6);
    expect(result.users.find((user) => user.id === 'demo-pengaju')?.researchIds).toEqual(['smart']);
    expect(upgradeDemo(result)).toBe(result);
  });
});
