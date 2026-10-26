import type { DemoSnapshot } from './model';

// Public demonstration accounts, never production credentials.
export const demoAccounts = [
  { id: 'demo-admin', email: 'admin@gmail.com', password: 'admin123', role: 'admin' },
  { id: 'demo-pengaju', email: 'pengaju@gmail.com', password: 'pengaju123', role: 'pengaju' },
] as const;

export function createSeed(): DemoSnapshot {
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
      researchIds: research.map((item) => item.id),
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
      researchIds: ['smart'],
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
  const owners = ['demo-pengaju', 'hasan', 'budi', 'siti', 'demo-pengaju', 'ahmadi'];
  const requests: DemoSnapshot['requests'] = items.map((item, index) => ({
    id: `request-${index + 1}`,
    item,
    ownerId: owners[index % owners.length] ?? 'demo-pengaju',
    researchId: research[index % research.length]?.id ?? 'smart',
    quantity: 1,
    unitPrice: prices.at(index) ?? (index === 23 ? '10500000' : '4500000'),
    status: [0, 4, 5, 6].includes(index)
      ? 'pending_review'
      : [1, 7].includes(index)
        ? 'ordered'
        : 'approved',
    requiredDate: '2026-11-12',
    url: '',
    notes: 'Data contoh untuk demonstrasi frontend.',
    deleted: false,
    createdAt: new Date(Date.UTC(2026, 9, 26 - index, 8)).toISOString(),
  }));
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
      requestId: 'request-5',
      message: 'Pengajuan pH Meter Digital menunggu persetujuan.',
      read: false,
      createdAt,
    },
  ];
  return { version: 1, accountId: null, users, research, requests, notifications };
}
