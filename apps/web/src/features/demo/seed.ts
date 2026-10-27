import { formatInTimeZone } from 'date-fns-tz';
import type { DemoSnapshot, RequestStatus } from './model';
import { createDemoRabs } from './demo-rab';

// Public demonstration accounts, never production credentials.
export const demoAccounts = [
  { id: 'demo-admin', email: 'admin@gmail.com', password: 'admin123', role: 'admin' },
  { id: 'demo-pengaju', email: 'pengaju@gmail.com', password: 'pengaju123', role: 'pengaju' },
] as const;

export function createSeed(now = new Date()): DemoSnapshot {
  const today = formatInTimeZone(now, 'Asia/Jakarta', 'yyyy-MM-dd');
  function day(offset: number) {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  }
  const research = [
    ['smart', 'Smart Mannequin', '75000000'],
    ['automation', 'Automation Weapon Rack', '62000000'],
    ['malware', 'ML Deteksi Malware', '55000000'],
    ['weather', 'Tel-U Weather Station', '48000000'],
    ['lake', 'Toksisitas Danau', '42000000'],
    ['farming', 'Modern Farming', '60000000'],
  ].map(([id = '', name = '', allocated = '0']) => ({
    id,
    name,
    allocated,
    description: `Proyek riset ${name}.`,
  }));
  const createdAt = '2026-09-01T00:00:00.000Z';
  const users: DemoSnapshot['users'] = [
    {
      id: 'demo-admin',
      name: 'Administrator',
      identifier: 'admin',
      email: 'admin@gmail.com',
      role: 'admin',
      researchIds: [],
      createdAt,
    },
    {
      id: 'demo-pengaju',
      name: 'Ir. Citra Dewi',
      identifier: '19880412001',
      email: 'pengaju@gmail.com',
      role: 'pengaju',
      researchIds: ['smart'],
      createdAt,
    },
    {
      id: 'hasan',
      name: 'Dr. Muhammad Hasan',
      identifier: '19850102002',
      email: 'hasan@example.test',
      role: 'pengaju',
      researchIds: ['lake'],
      createdAt,
    },
    {
      id: 'ahmadi',
      name: 'Dr. Ahmadi',
      identifier: '19880412003',
      email: 'ahmadi@example.test',
      role: 'pengaju',
      researchIds: ['malware'],
      createdAt,
    },
    {
      id: 'budi',
      name: 'Dr. Budi Santoso',
      identifier: '607012400005',
      email: 'budi@example.test',
      role: 'pengaju',
      researchIds: ['weather'],
      createdAt,
    },
    {
      id: 'siti',
      name: 'Prof. Siti Rahayu',
      identifier: '19850102004',
      email: 'siti@example.test',
      role: 'pengaju',
      researchIds: ['automation'],
      createdAt,
    },
    {
      id: 'eka',
      name: 'Eka Pratama',
      identifier: '607012400006',
      email: 'eka@example.test',
      role: 'pengaju',
      researchIds: ['farming'],
      createdAt,
    },
  ];
  const items = [
    'Oscilloscope Digital',
    'Spektrofotometer UV-Vis',
    'Micropipette Set',
    'Centrifuge Machine',
    'pH Meter Digital',
    'Sensor Suhu',
    'Modul Akuisisi Data',
    'Power Supply',
    'Kamera Riset',
    'Sensor Kelembapan',
    'Mikroskop Digital',
    'Komputer Analisis',
    'Modul GPS',
    'Sensor Tekanan',
    'Pompa Air',
    'Data Logger',
    'Perangkat Kalibrasi',
    'Router Laboratorium',
    'Sistem Pendingin',
    'Solder Station',
    'Panel Kontrol',
    'Kabel Instrumentasi',
    'Rak Perangkat',
    'Perangkat Uji',
  ];
  const prices = ['12500000', '8900000', '3200000', '7500000', '1800000'];
  const researchIds = [
    'smart',
    'automation',
    'malware',
    'weather',
    'lake',
    'farming',
    'smart',
    'automation',
    'malware',
    'weather',
    'smart',
    'smart',
    'smart',
    'automation',
    'lake',
    'farming',
    'smart',
    'malware',
    'smart',
    'automation',
    'lake',
    'farming',
    'smart',
    'weather',
  ];
  const deadlines = [
    -2, 3, 5, 12, -5, 1, 0, 6, 16, 2, 6, 14, -3, 10, 4, 18, -11, -4, -1, 21, 3, 7, 25, 30,
  ];
  const stages: RequestStatus[] = [
    'pending_review',
    'approved',
    'ordered',
    'in_transit',
    'delivered',
    'completed',
  ];
  const requests: DemoSnapshot['requests'] = items.map((item, index) => {
    const researchId = researchIds.at(index) ?? 'smart';
    const status: RequestStatus = [0, 4, 5, 6].includes(index)
      ? 'pending_review'
      : [1, 7, 11].includes(index)
        ? 'ordered'
        : index === 10
          ? 'in_transit'
          : index === 12
            ? 'delivered'
            : index === 16
              ? 'delivered'
              : 'approved';
    const submitted = -(7 + index * 2);
    const stageIndex = stages.indexOf(status);
    return {
      id: `request-${index + 1}`,
      item,
      ownerId: users.find((user) => user.researchIds.includes(researchId))?.id ?? 'demo-pengaju',
      researchId,
      quantity: 1,
      unit: 'unit',
      invoice: null,
      fulfillment: null,
      rabDocumentId: null,
      rabItemId: null,
      unitPrice: prices.at(index) ?? (index === 23 ? '10500000' : '4500000'),
      status,
      submissionStatus: 'not_submitted',
      requiredDate: day(deadlines.at(index) ?? 14),
      url: '',
      notes: 'Data contoh untuk demonstrasi frontend.',
      deleted: false,
      statusHistory: stages.slice(1, stageIndex + 1).map((to, step) => ({
        from: stages.at(step) ?? 'pending_review',
        to,
        actorId: 'demo-admin',
        reason: 'Riwayat contoh demonstrasi.',
        at: `${day(to === 'delivered' ? (index === 12 ? -4 : -12) : to === 'completed' ? -10 : submitted + 3 + step * 2)}T08:00:00.000Z`,
      })),
      createdAt: `${day(submitted)}T08:00:00.000Z`,
    };
  });
  const notifications: DemoSnapshot['notifications'] = [
    {
      id: 'notice-1',
      recipientId: 'demo-admin',
      requestId: 'request-1',
      message: 'Oscilloscope Digital menunggu persetujuan.',
      read: false,
      createdAt,
    },
    {
      id: 'notice-2',
      recipientId: 'demo-admin',
      requestId: 'request-5',
      message: 'pH Meter Digital diajukan untuk riset.',
      read: false,
      createdAt,
    },
    {
      id: 'notice-3',
      recipientId: 'demo-admin',
      requestId: 'request-6',
      message: 'Sensor Suhu menunggu peninjauan.',
      read: false,
      createdAt,
    },
    {
      id: 'notice-4',
      recipientId: 'demo-pengaju',
      requestId: 'request-1',
      message: 'Pengajuan Oscilloscope Digital diterima untuk ditinjau.',
      read: false,
      createdAt,
    },
    {
      id: 'notice-5',
      recipientId: 'demo-pengaju',
      requestId: 'request-7',
      message: 'Pengajuan Modul Akuisisi Data menunggu persetujuan.',
      read: false,
      createdAt,
    },
  ];
  return {
    version: 1,
    demoRevision: 1,
    accountId: null,
    adminNoticeSeen: false,
    users,
    research,
    requests,
    notifications,
    rabDocuments: createDemoRabs(research, `${day(-14)}T08:00:00.000Z`),
  };
}
