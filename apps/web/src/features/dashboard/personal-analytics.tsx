import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Dot,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { ThemedSelect } from '@/components/ui/themed-select';
import { useDemo } from '../demo/use-demo';
import { formatDate, formatMoney, statusLabelMap } from '../demo/model';
import { personalFollowup, personalReceiptTrend, activeStatuses, shortDate } from './analytics';
import { StatusBadge } from './shared';
import { useRecordNavigation } from './record-navigation';
import styles from './dashboard.module.css';
import { cn } from '@/lib/utils';

function TrendDot({
  payload,
  onChooseWeek,
  series,
  ...props
}: ComponentProps<typeof Dot> & {
  payload?: unknown;
  onChooseWeek: (from: string) => void;
  series: string;
}) {
  const from =
    payload && typeof payload === 'object' && 'from' in payload && typeof payload.from === 'string'
      ? payload.from
      : '';
  if (!from) return <Dot {...props} />;
  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={props.r}
      fill={props.fill}
      stroke={props.stroke}
      strokeWidth={props.strokeWidth}
      className={cn('recharts-dot', props.className, styles.chartPoint)}
      role="button"
      tabIndex={0}
      aria-label={`Lihat ${series} minggu ${shortDate(from)}`}
      onClick={(event) => {
        event.stopPropagation();
        onChooseWeek(from);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onChooseWeek(from);
        }
      }}
    />
  );
}

const followupConfig = { age: { label: 'Usia pengajuan (hari)', color: 'var(--ui-primary)' } };
const trendConfig = {
  submissions: { label: 'Diajukan', color: 'var(--ui-primary)' },
  receipts: { label: 'Diterima', color: 'var(--ui-chart-ordered)' },
};
export default function PersonalAnalytics() {
  const { data, user } = useDemo();
  const [now] = useState(() => new Date());
  const [params, setParams] = useSearchParams();
  const { link } = useRecordNavigation('/dashboard');
  const navigate = useNavigate();
  if (!user) return null;
  const status = activeStatuses.find((value) => value === params.get('followupStatus')) ?? '';
  const requested = Number(params.get('personalWeeks'));
  const weeks = [4, 8, 12].includes(requested) ? requested : 8;
  const followup = personalFollowup(data, user, status, now);
  const { buckets, missingReceiptDates } = personalReceiptTrend(data, user, weeks, now);
  const peak = Math.max(1, ...buckets.flatMap((bucket) => [bucket.submissions, bucket.receipts]));
  const selected = buckets.find((bucket) => bucket.from === params.get('personalWeek'));
  function update(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name === 'personalWeeks') next.delete('personalWeek');
    setParams(next, { replace: true });
  }
  function openRequest(entry: unknown) {
    if (!entry || typeof entry !== 'object' || !('payload' in entry)) return;
    const point: unknown = entry.payload;
    if (
      point &&
      typeof point === 'object' &&
      'id' in point &&
      typeof point.id === 'string' &&
      followup.some((row) => row.id === point.id)
    )
      void navigate(link('/requests/' + point.id));
  }
  return (
    <section className={styles.analytics} aria-label="Analitik pengajuan pribadi">
      <article className={styles.chartPanel}>
        <div className={styles.chartHeading}>
          <div>
            <h2>Request yang perlu ditindaklanjuti</h2>
            <p>
              Usia sejak pengajuan, dari yang paling lama; hanya barang Anda yang belum diterima.
            </p>
          </div>
          <ThemedSelect
            label="Status tindak lanjut"
            value={status}
            onValueChange={(value) => update('followupStatus', value)}
            options={[
              { value: '', label: 'Semua tahap aktif' },
              ...activeStatuses.map((value) => ({
                value,
                label: statusLabelMap.get(value) ?? value,
              })),
            ]}
          />
        </div>
        {followup.length ? (
          <ChartContainer
            role="group"
            config={followupConfig}
            className="h-72 w-full"
            aria-label="Grafik usia request aktif"
            data-chart-ready="true"
          >
            <BarChart
              accessibilityLayer
              layout="vertical"
              data={followup.slice(0, 8)}
              margin={{ top: 8, right: 40, left: 0, bottom: 20 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                dataKey="age"
                domain={[0, 'dataMax + 1']}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Hari sejak diajukan', position: 'insideBottom', offset: -14 }}
              />
              <YAxis
                type="category"
                dataKey="item"
                width={122}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: string) =>
                  value.length > 18 ? value.slice(0, 17) + '…' : value
                }
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof followup)[number] | undefined;
                  return active && row ? (
                    <div className={styles.chartTooltip}>
                      <strong>{row.item}</strong>
                      <span>
                        {row.age} hari sejak {formatDate(row.createdAt)}
                      </span>
                      <span>{statusLabelMap.get(row.status)}</span>
                      <span>Kebutuhan {formatDate(row.requiredDate)}</span>
                      <strong>{formatMoney(row.value)}</strong>
                    </div>
                  ) : null;
                }}
              />
              <Bar
                dataKey="age"
                fill="var(--color-age)"
                radius={[0, 4, 4, 0]}
                barSize={18}
                isAnimationActive={false}
                onClick={openRequest}
              >
                <LabelList dataKey="age" position="right" fontSize={11} />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <p className={styles.chartEmpty}>Tidak ada request aktif pada tahap ini.</p>
        )}
        <p className={styles.hint}>
          {followup.length} request aktif
          {followup.length > 8 ? ' · Grafik menampilkan 8 paling lama' : ''} · Klik batang atau buka
          barang pada tabel.
        </p>
        <details className={styles.chartData}>
          <summary>Lihat daftar tindak lanjut</summary>
          <div className={styles.tableWrap}>
            <table>
              <caption className="sr-only">
                Request aktif milik Anda berdasarkan usia pengajuan
              </caption>
              <thead>
                <tr>
                  <th scope="col">Barang</th>
                  <th scope="col">Usia</th>
                  <th scope="col">Tahap</th>
                </tr>
              </thead>
              <tbody>
                {followup.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className={styles.textLink} to={link('/requests/' + row.id)}>
                        {row.item}
                      </Link>
                    </td>
                    <td>{row.age} hari</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
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
            <h2>Tren pengajuan dan penerimaan</h2>
            <p>
              Jumlah request per minggu, bukan jumlah unit; tanggal penerimaan mengikuti riwayat
              Admin.
            </p>
          </div>
          <ThemedSelect
            label="Periode tren pribadi"
            value={String(weeks)}
            onValueChange={(value) => update('personalWeeks', value)}
            options={[4, 8, 12].map((value) => ({
              value: String(value),
              label: value + ' minggu terakhir',
            }))}
          />
        </div>
        {buckets.some((bucket) => bucket.submissions || bucket.receipts) ? (
          <ChartContainer
            role="group"
            config={trendConfig}
            className="h-72 w-full"
            aria-label="Grafik tren pengajuan dan penerimaan"
            data-chart-ready="true"
          >
            <LineChart
              accessibilityLayer
              data={buckets}
              margin={{ top: 12, right: 12, bottom: 12, left: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="from"
                tickFormatter={(value: string) => shortDate(value)}
                minTickGap={20}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, peak]}
                tickCount={Math.min(5, peak + 1)}
                width={30}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  const bucket = payload?.[0]?.payload as (typeof buckets)[number] | undefined;
                  return active && bucket ? (
                    <div className={styles.chartTooltip}>
                      <strong>
                        {formatDate(bucket.from)} – {formatDate(bucket.to)}
                      </strong>
                      <span>Diajukan: {bucket.submissions} request</span>
                      <span>Diterima: {bucket.receipts} request</span>
                      <span>Nilai pengajuan: {formatMoney(bucket.value)}</span>
                      {bucket.partial && <span>Minggu berjalan belum lengkap.</span>}
                    </div>
                  ) : null;
                }}
              />
              <Line
                type="linear"
                dataKey="submissions"
                stroke="var(--color-submissions)"
                strokeWidth={2}
                dot={
                  <TrendDot
                    series="pengajuan"
                    onChooseWeek={(from) => update('personalWeek', from)}
                    r={3}
                  />
                }
                activeDot={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="receipts"
                stroke="var(--color-receipts)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={
                  <TrendDot
                    series="penerimaan"
                    onChooseWeek={(from) => update('personalWeek', from)}
                    r={4}
                  />
                }
                activeDot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className={styles.chartEmpty}>
            Belum ada pengajuan atau penerimaan tercatat pada periode ini.
          </p>
        )}
        <ul className={styles.chartKey}>
          <li>
            <span className={styles.submissionLine} aria-hidden="true" />
            Diajukan
          </li>
          <li>
            <span className={styles.receiptLine} aria-hidden="true" />
            Diterima
          </li>
        </ul>
        <p className={styles.hint}>
          Minggu dimulai Senin (WIB); minggu berjalan belum lengkap. Pilih minggu untuk melihat
          barang.
          {missingReceiptDates > 0 &&
            ' ' +
              missingReceiptDates +
              ' request diterima belum memiliki tanggal riwayat dan tidak dihitung pada garis penerimaan.'}
        </p>
        <details className={styles.chartData}>
          <summary>Lihat data pengajuan dan penerimaan</summary>
          <div className={styles.tableWrap}>
            <table>
              <caption className="sr-only">Pengajuan dan penerimaan milik Anda per minggu</caption>
              <thead>
                <tr>
                  <th scope="col">Minggu</th>
                  <th scope="col">Diajukan</th>
                  <th scope="col">Diterima</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.from}>
                    <td>
                      <button
                        type="button"
                        className={styles.inlineButton}
                        aria-pressed={selected?.from === bucket.from}
                        onClick={() => update('personalWeek', bucket.from)}
                      >
                        {shortDate(bucket.from)} – {shortDate(bucket.to)}
                      </button>
                    </td>
                    <td>{bucket.submissions}</td>
                    <td>{bucket.receipts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        {selected && (
          <div
            className={styles.personalSelection}
            role="region"
            aria-label="Barang pada minggu terpilih"
          >
            <h3>
              {formatDate(selected.from)} – {formatDate(selected.to)}
            </h3>
            {[
              { label: 'Diajukan', rows: selected.submitted },
              { label: 'Diterima', rows: selected.received },
            ].map(({ label, rows }) => (
              <div key={label}>
                <h4>
                  {label} ({rows.length})
                </h4>
                {rows.map((row) => (
                  <Link key={row.id} className={styles.textLink} to={link('/requests/' + row.id)}>
                    {row.item}
                  </Link>
                ))}
                {!rows.length && <p className={styles.hint}>Tidak ada barang.</p>}
              </div>
            ))}
            <button
              type="button"
              className={styles.inlineButton}
              onClick={() => update('personalWeek', '')}
            >
              Tutup pilihan minggu
            </button>
          </div>
        )}
      </article>
    </section>
  );
}
