import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Scatter,
  ScatterChart,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { ThemedSelect } from '@/components/ui/themed-select';
import { useDemo } from '../demo/use-demo';
import { formatDate, formatMoney, statusLabelMap } from '../demo/model';
import { trendAnalytics, urgencyAnalytics, urgencyGroups, lastEightWeeks } from './analytics';
import type { UrgencyPoint } from './analytics';
import { datePresets, validRange, wibDay } from './date-range';
import { DateRangePicker } from './date-range-picker';
import { useRecordNavigation } from './record-navigation';
import styles from './dashboard.module.css';
const config = { value: { label: 'Nilai pengajuan', color: 'var(--ui-primary)' } };
const compact = (value: number) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export default function AdminAnalytics() {
  const { data } = useDemo();
  const [now] = useState(() => new Date());
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { link } = useRecordNavigation('/dashboard');
  const custom = { from: params.get('trendFrom') ?? '', to: params.get('trendTo') ?? '' };
  const today = wibDay(now);
  const earliest =
    data.requests
      .filter((row) => !row.deleted && wibDay(row.createdAt) <= today)
      .map((row) => wibDay(row.createdAt))
      .toSorted()[0] ?? today;
  const all = params.get('trend') === 'all';
  const range = all
    ? { from: earliest, to: today }
    : validRange(custom)
      ? custom
      : lastEightWeeks(now);
  const { trend, unit } = trendAnalytics(data.requests, range, now);
  const researchId = data.research.some((item) => item.id === params.get('urgencyResearch'))
    ? (params.get('urgencyResearch') ?? '')
    : '';
  const urgency = urgencyAnalytics(data, researchId, now);
  function openPoint(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const point = 'payload' in value ? value.payload : value;
    if (
      point &&
      typeof point === 'object' &&
      'id' in point &&
      typeof point.id === 'string' &&
      urgency.some((row) => row.id === point.id)
    )
      void navigate(link(`/requests/${point.id}`));
  }
  return (
    <section className={styles.analytics} aria-label="Analitik Pembelian Barang">
      <article className={styles.chartPanel}>
        <div className={styles.chartHeading}>
          <div>
            <h2>Tren nilai Pembelian Barang</h2>
            <p>Nilai pengajuan dalam WIB, bukan pembayaran.</p>
          </div>
          <DateRangePicker
            controlLabel="Periode tren"
            value={all ? null : range}
            presets={[
              ...datePresets(now),
              { label: '8 minggu terakhir', range: lastEightWeeks(now) },
            ]}
            onValueChange={(value) => {
              const next = new URLSearchParams(params);
              next.delete('trendFrom');
              next.delete('trendTo');
              next.delete('trend');
              if (value) {
                next.set('trendFrom', value.from);
                next.set('trendTo', value.to);
              } else next.set('trend', 'all');
              setParams(next, { replace: true });
            }}
          />
        </div>
        <p className={styles.hint}>
          Agregasi {unit === 'day' ? 'harian' : unit === 'week' ? 'mingguan' : 'bulanan'} ·{' '}
          {formatDate(range.from)} – {formatDate(range.to)}
          {trend.some((point) => point.partial) ? ' · Periode tepi belum lengkap' : ''}
        </p>
        {trend.some((point) => point.count) ? (
          <ChartContainer
            role="group"
            config={config}
            className="h-64 w-full"
            aria-label="Grafik tren nilai"
            data-chart-ready="true"
          >
            <LineChart accessibilityLayer data={trend}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis width={58} tickFormatter={compact} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={({ active, payload }) => {
                  const bucket = payload?.[0]?.payload as (typeof trend)[number] | undefined;
                  return active && bucket ? (
                    <div className={styles.chartTooltip}>
                      <strong>
                        {formatDate(bucket.from)} – {formatDate(bucket.to)}
                        {bucket.partial ? ' (sebagian periode)' : ''}
                      </strong>
                      <span>
                        {formatMoney(bucket.value)} · {bucket.count} request
                      </span>
                    </div>
                  ) : null;
                }}
              />
              <Line
                dataKey="value"
                type="linear"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className={styles.empty}>Belum ada request pada periode ini.</p>
        )}
        <details className={styles.chartData}>
          <summary>Lihat data tren</summary>
          <div className={styles.tableWrap}>
            <table>
              <caption className="sr-only">Nilai pengajuan per periode</caption>
              <thead>
                <tr>
                  <th scope="col">Periode</th>
                  <th scope="col">Request</th>
                  <th scope="col">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((point) => (
                  <tr key={point.start}>
                    <td>
                      {formatDate(point.from)} – {formatDate(point.to)}
                      {point.partial && <small> (sebagian)</small>}
                    </td>
                    <td>{point.count}</td>
                    <td>{formatMoney(point.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </article>
      <article className={styles.chartPanel}>
        <div className={styles.chartHeading}>
          <div>
            <h2>Peta urgensi request</h2>
            <p>Barang aktif berdasarkan tanggal kebutuhan, terpisah dari periode tren.</p>
          </div>
          <ThemedSelect
            label="Riset peta urgensi"
            value={researchId}
            onValueChange={(value) => {
              const next = new URLSearchParams(params);
              if (value) next.set('urgencyResearch', value);
              else next.delete('urgencyResearch');
              setParams(next, { replace: true });
            }}
            options={[
              { value: '', label: 'Semua riset' },
              ...data.research.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        </div>
        {urgency.length ? (
          <>
            <ChartContainer
              role="group"
              config={config}
              className="h-64 w-full"
              aria-label="Grafik peta urgensi"
              data-chart-ready="true"
            >
              <ScatterChart accessibilityLayer margin={{ top: 32, left: 8, right: 20, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="days"
                  name="Sisa hari"
                  allowDecimals={false}
                  domain={([min, max]: readonly [number, number]) => [
                    Math.min(min - 2, -1),
                    Math.max(max + 2, 3),
                  ]}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Hari menuju kebutuhan', position: 'insideBottom', offset: -10 }}
                />
                <YAxis
                  type="number"
                  dataKey="value"
                  name="Nilai request"
                  width={58}
                  tickFormatter={compact}
                  tickLine={false}
                  axisLine={false}
                />
                <ReferenceLine
                  x={0}
                  stroke="var(--ui-muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Hari ini',
                    position: 'top',
                    offset: 12,
                    fontSize: 11,
                    fill: 'var(--ui-ink)',
                  }}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as UrgencyPoint | undefined;
                    return active && point ? (
                      <div className={styles.chartTooltip}>
                        <strong>{point.item}</strong>
                        <span>
                          {point.owner} · {point.research}
                        </span>
                        <span>{statusLabelMap.get(point.status)}</span>
                        <span>
                          {formatDate(point.date)} ·{' '}
                          {point.days < 0
                            ? `${-point.days} hari terlambat`
                            : `${point.days} hari lagi`}
                        </span>
                        <strong>{formatMoney(point.value)}</strong>
                      </div>
                    ) : null;
                  }}
                />
                {urgencyGroups.map((group) => (
                  <Scatter
                    key={group.key}
                    name={group.label}
                    data={urgency.filter((point) => point.group === group.key)}
                    fill={group.color}
                    shape={group.shape}
                    isAnimationActive={false}
                    onClick={openPoint}
                  />
                ))}
              </ScatterChart>
            </ChartContainer>
            <ul className={styles.chartKey}>
              {urgencyGroups.map((group) => (
                <li key={group.key}>
                  <span aria-hidden="true" style={{ color: group.color }}>
                    {group.shape === 'triangle'
                      ? '▲'
                      : group.shape === 'diamond'
                        ? '◆'
                        : group.shape === 'square'
                          ? '■'
                          : '●'}
                  </span>
                  {group.label} ({urgency.filter((point) => point.group === group.key).length})
                </li>
              ))}
            </ul>
            <p className={styles.hint}>
              {urgency.length} barang aktif · {urgency.filter((point) => point.days < 0).length}{' '}
              terlambat · Klik titik atau buka barang pada daftar.
            </p>
            <details className={styles.chartData}>
              <summary>Lihat daftar prioritas ({urgency.length})</summary>
              <div className={styles.tableWrap}>
                <table>
                  <caption className="sr-only">
                    Urutan tanggal terdekat, lalu nilai terbesar; titik bertumpuk tetap tersedia di
                    sini.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Barang</th>
                      <th scope="col">Kebutuhan</th>
                      <th scope="col">Sisa hari</th>
                      <th scope="col">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgency.map((point) => (
                      <tr key={point.id}>
                        <td>
                          <Link className={styles.textLink} to={link(`/requests/${point.id}`)}>
                            {point.item}
                          </Link>
                          <small className={styles.hint}>
                            {point.owner} · {point.research}
                          </small>
                        </td>
                        <td>{formatDate(point.date)}</td>
                        <td>
                          {point.days < 0 ? `${-point.days} hari terlambat` : `${point.days} hari`}
                        </td>
                        <td>{formatMoney(point.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className={styles.empty}>Tidak ada barang aktif yang perlu dipantau.</p>
        )}
      </article>
    </section>
  );
}
