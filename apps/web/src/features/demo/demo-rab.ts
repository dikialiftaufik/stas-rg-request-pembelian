import type { DemoResearch, RabDocument, RabItem } from './model';

export function demoRabCsv(items: RabItem[]) {
  return (
    '\ufeff' +
    [
      ['Nama barang', 'Jumlah', 'Satuan', 'Harga satuan', 'Keterangan'],
      ...items.map((item) => [item.name, item.quantity, item.unit, item.unitPrice, item.notes]),
    ]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
  );
}

export function createDemoRabs(research: DemoResearch[], createdAt: string): RabDocument[] {
  const catalog = [
    [
      ['Sensor tekanan FSR', 8, 'unit', '185000'],
      ['Modul ESP32', 4, 'unit', '125000'],
      ['Kabel sensor dan konektor', 2, 'set', '275000'],
    ],
    [
      ['Motor stepper NEMA 17', 4, 'unit', '325000'],
      ['Driver motor', 4, 'unit', '185000'],
      ['Limit switch', 10, 'unit', '35000'],
    ],
    [
      ['SSD eksternal 1 TB', 2, 'unit', '1450000'],
      ['Memori DDR5 32 GB', 2, 'unit', '1650000'],
      ['Adaptor jaringan USB', 3, 'unit', '275000'],
    ],
    [
      ['Sensor hujan tipping bucket', 2, 'unit', '1850000'],
      ['Sensor suhu dan kelembapan', 4, 'unit', '485000'],
      ['Panel surya 50 Wp', 2, 'unit', '750000'],
    ],
    [
      ['Reagen uji kualitas air', 3, 'paket', '1250000'],
      ['Botol sampel 500 ml', 24, 'unit', '45000'],
      ['Sarung tangan nitril', 4, 'kotak', '135000'],
    ],
    [
      ['Sensor kelembapan tanah', 12, 'unit', '65000'],
      ['Pompa irigasi 12 V', 4, 'unit', '385000'],
      ['Selang dan konektor irigasi', 3, 'set', '225000'],
    ],
  ] as const;
  return research.map((project, index) => {
    const id = `demo-rab-${project.id}`;
    const items = (catalog.at(index % catalog.length) ?? catalog[0]).map(
      ([name, quantity, unit, unitPrice], itemIndex) => ({
        id: `${id}-item-${itemIndex + 1}`,
        name,
        quantity,
        unit,
        unitPrice,
        notes: 'Contoh rencana kebutuhan riset; jumlah pengajuan dapat disesuaikan.',
      }),
    );
    const sourceText = demoRabCsv(items);
    return {
      id,
      researchId: project.id,
      name: `RAB ${project.name}`,
      version: 1,
      active: true,
      sourceKind: 'demo',
      createdAt,
      createdBy: 'demo-admin',
      items,
      source: {
        id: `${id}-source`,
        sessionId: 'demo-catalogue',
        name: `RAB-${project.id}.csv`,
        mime: 'text/csv',
        size: new TextEncoder().encode(sourceText).length,
        uploadedAt: createdAt,
        uploadedBy: 'demo-admin',
      },
    };
  });
}
