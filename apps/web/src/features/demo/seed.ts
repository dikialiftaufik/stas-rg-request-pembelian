import type { DemoSnapshot } from './model';

export const demoAccounts = [
  { id: 'demo-admin', email: 'admin@gmail.com', password: 'admin123', role: 'admin' },
  { id: 'demo-pengaju', email: 'pengaju@gmail.com', password: 'pengaju123', role: 'pengaju' },
] as const;

export function createSeed(_now?: Date): DemoSnapshot {
  void _now;
  return {
    version: 1,
    demoRevision: 2,
    accountId: null,
    adminNoticeSeen: false,
    users: [
      {
        id: 'demo-admin',
        name: 'Administrator',
        identifier: 'admin',
        email: 'admin@gmail.com',
        role: 'admin',
        researchIds: [],
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'demo-pengaju',
        name: 'Ir. Citra Dewi',
        identifier: '19880412001',
        email: 'pengaju@gmail.com',
        role: 'pengaju',
        researchIds: [],
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    research: [],
    requests: [],
    notifications: [],
    rabDocuments: [],
  };
}
