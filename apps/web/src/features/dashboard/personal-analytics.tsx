import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { ThemedSelect } from '@/components/ui/themed-select';
import { useDemo } from '../demo/use-demo';
import { formatDate, formatMoney, requestTotal, statusLabelMap } from '../demo/model';
import { personalAgenda, activeStatuses } from './analytics';
import { StatusBadge } from './shared';
import { useRecordNavigation } from './record-navigation';
import styles from './dashboard.module.css';
const config = {
  pending_review: { label: 'Menunggu persetujuan', color: 'var(--ui-chart-urgent)' },
  approved: { label: 'Disetujui', color: 'var(--ui-chart-soon)' },
  ordered: { label: 'Sudah dipesan', color: 'var(--ui-chart-ordered)' },
  in_transit: { label: 'Dalam pengiriman', color: 'var(--ui-primary)' },
};
export default function PersonalAnalytics() {
  const { data, user } = useDemo();
  const [now] = useState(() => new Date());
  const [params, setParams] = useSearchParams();
  const { link } = useRecordNavigation('/dashboard');
  if (!user) return null;
  const requested = Number(params.get('agendaWeeks'));
  const weeks = [4, 8, 12].includes(requested) ? requested : 4;
  const { buckets, outside } = personalAgenda(data, user, weeks, now);
  const selected = buckets.some((bucket) => bucket.key === params.get('agenda'))
    ? (params.get('agenda') ?? '')
    : '';
  const status = activeStatuses.find((value) => value === params.get('agendaStatus')) ?? '';
  const agenda = buckets
    .filter((bucket) => !selected || bucket.key === selected)
    .flatMap((bucket) => bucket.requests)
    .filter((row) => !status || row.status === status)
    .toSorted((a, b) => a.requiredDate.localeCompare(b.requiredDate) || a.id.localeCompare(b.id));
  function update(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name === 'agendaWeeks') {
      next.delete('agenda');
      next.delete('agendaStatus');
    }
    setParams(next, { replace: true });
  }
  function selectBar(entry: unknown, value: string) {
    if (!entry || typeof entry !== 'object' || !('payload' in entry)) return;
    const payload: unknown = entry.payload;
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('key' in payload) ||
      typeof payload.key !== 'string'
    )
      return;
    const next = new URLSearchParams(params);
    next.set('agenda', payload.key);
    next.set('agendaStatus', value);
    setParams(next, { replace: true });
  }
  return (
    <section className={styles.agendaPanel} aria-label="Analitik kebutuhan pribadi">
      <div className={styles.chartHeading}>
        <div>
          <h2>Kebutuhan barang saya</h2>
          <p>Rencanakan kebutuhan mingguan dan pantau barang yang masih diproses.</p>
        </div>
        <ThemedSelect
          label="Rentang agenda"
          value={String(weeks)}
          onValueChange={(value) => update('agendaWeeks', value)}
          options={[4, 8, 12].map((value) => ({
            value: String(value),
            label: `${value} minggu mendatang`,
          }))}
        />
      </div>
      {buckets.some((bucket) => bucket.requests.length) ? (
        <ChartContainer
          role="group"
          config={config}
          className="h-64 w-full"
          aria-label="Grafik kebutuhan barang saya"
          data-chart-ready="true"
        >
          <BarChart accessibilityLayer data={buckets}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
            <ChartTooltip
              content={({ active, payload }) => {
                const bucket = payload?.[0]?.payload as (typeof buckets)[number] | undefined;
                return active && bucket ? (
                  <div className={styles.chartTooltip}>
                    <strong>
                      {bucket.key === 'overdue'
                        ? 'Tanggal kebutuhan sudah lewat'
                        : `${formatDate(bucket.from)} – ${formatDate(bucket.to)}`}
                    </strong>
                    <span>
                      {bucket.requests.length} request · {formatMoney(bucket.value)}
                    </span>
                    {activeStatuses.map((value) => (
                      <span key={value}>
                        {statusLabelMap.get(value)}:{' '}
                        {bucket.requests.filter((row) => row.status === value).length}
                      </span>
                    ))}
                  </div>
                ) : null;
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {activeStatuses.map((value) => (
              <Bar
                key={value}
                dataKey={value}
                stackId="agenda"
                fill={`var(--color-${value})`}
                isAnimationActive={false}
                onClick={(entry) => selectBar(entry, value)}
              />
            ))}
          </BarChart>
        </ChartContainer>
      ) : (
        <p className={styles.empty}>Tidak ada kebutuhan aktif pada periode ini.</p>
      )}
      <p className={styles.hint}>
        Jumlah menunjukkan request, bukan jumlah unit. Klik batang atau gunakan pilihan agenda di
        bawah.{outside > 0 && ` Ada ${outside} request di luar periode ini.`}
      </p>
      <div className={styles.agendaFilters}>
        <ThemedSelect
          label="Minggu agenda"
          value={selected}
          onValueChange={(value) => update('agenda', value)}
          options={[
            { value: '', label: 'Semua minggu' },
            ...buckets.map((bucket) => ({
              value: bucket.key,
              label:
                bucket.key === 'overdue'
                  ? 'Terlambat'
                  : `${formatDate(bucket.from)} – ${formatDate(bucket.to)}`,
            })),
          ]}
        />
        <ThemedSelect
          label="Status agenda"
          value={status}
          onValueChange={(value) => update('agendaStatus', value)}
          options={[
            { value: '', label: 'Semua tahap aktif' },
            ...activeStatuses.map((value) => ({
              value,
              label: statusLabelMap.get(value) ?? value,
            })),
          ]}
        />
      </div>
      <details className={styles.chartData}>
        <summary>Lihat data kebutuhan mingguan</summary>
        <div className={styles.tableWrap}>
          <table>
            <caption className="sr-only">Kebutuhan aktif milik akun Anda per minggu</caption>
            <thead>
              <tr>
                <th scope="col">Periode</th>
                <th scope="col">Request</th>
                <th scope="col">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.key}>
                  <td>
                    <button
                      className={styles.inlineButton}
                      type="button"
                      onClick={() => update('agenda', bucket.key)}
                    >
                      {bucket.key === 'overdue'
                        ? 'Terlambat'
                        : `${formatDate(bucket.from)} – ${formatDate(bucket.to)}`}
                    </button>
                  </td>
                  <td>{bucket.requests.length}</td>
                  <td>{formatMoney(bucket.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className={styles.agendaItems} role="region" aria-label="Agenda barang terpilih">
        <h3>Agenda barang ({agenda.length})</h3>
        {agenda.map((row) => (
          <article key={row.id}>
            <div>
              <Link className={styles.textLink} to={link(`/requests/${row.id}`)}>
                {row.item}
              </Link>
              <small>
                {formatDate(row.requiredDate)} · {formatMoney(requestTotal(row))}
              </small>
            </div>
            <StatusBadge status={row.status} />
          </article>
        ))}
        {!agenda.length && (
          <p className={styles.empty}>Tidak ada barang yang sesuai pilihan agenda.</p>
        )}
      </div>
    </section>
  );
}
