import { useState } from 'react';
import Decimal from 'decimal.js';
import {
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
  ArrowsUpDownIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { useDemo } from '../demo/use-demo';
import { dashboardSummary, scopedRequests, deleteUser, deleteResearch } from '../demo/store';
import { formatMoney, formatDate, researchUsed } from '../demo/model';
import { demoAccounts } from '../demo/seed';
import { ConfirmDialog, PageHeading, Pagination } from './shared';
import { UserEditor, ResearchEditor } from './editors';
import { RequestList } from './request-list';
import styles from './dashboard.module.css';

export function DashboardPage() {
  const { data, user } = useDemo();
  const [now] = useState(() => new Date());
  if (!user) return null;
  const summary = dashboardSummary(data, user);
  const scoped = scopedRequests(data, user);
  const lastSevenDays = scoped.filter((item) => {
    const created = new Date(item.createdAt).getTime();
    return created >= now.getTime() - 7 * 86400000 && created <= now.getTime();
  }).length;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  const approvedToday = scoped.filter(
    (item) =>
      item.status === 'approved' &&
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
        new Date(item.createdAt),
      ) === today,
  ).length;
  const cards = [
    {
      label: 'Total Request',
      value: String(summary.total),
      note: `+${lastSevenDays} dalam 7 hari`,
      icon: ShoppingCartIcon,
      tone: 'green',
    },
    {
      label: 'Disetujui',
      value: String(summary.approved),
      note: `+${approvedToday} hari ini`,
      icon: CheckCircleIcon,
      tone: 'blue',
    },
    { label: 'Menunggu', value: String(summary.pending), note: '', icon: ClockIcon, tone: 'amber' },
    {
      label: 'Total Nilai',
      value: summary.value.gte(1000000)
        ? `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(summary.value.div(1000000).toNumber())} Jt`
        : formatMoney(summary.value),
      note: '',
      icon: ArrowTrendingUpIcon,
      tone: 'indigo',
    },
  ];
  return (
    <>
      <PageHeading
        title="Dashboard Pengadaan"
        description="Selamat datang di sistem manajemen pengadaan riset STAS-RG"
        action={<span className={styles.demoBadge}>Mode demo · Data contoh</span>}
      />
      <section className={styles.stats} aria-label="Ringkasan pengadaan">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <article className={styles.statCard} key={label} aria-label={label}>
            <div>
              <h2 className={styles.statLabel}>{label}</h2>
              <p className={styles.statValue}>{value}</p>
              {note && <p className={styles.statTrend}>{note}</p>}
            </div>
            <span className={styles.statIcon} data-tone={tone}>
              <Icon aria-hidden="true" />
            </span>
          </article>
        ))}
      </section>
      <RequestList recent />
    </>
  );
}

export function RequestsPage() {
  const { user } = useDemo();
  return (
    <>
      <PageHeading
        eyebrow={user?.role === 'admin' ? 'Monitoring operasional' : 'Pengajuan kebutuhan riset'}
        title="Request Pembelian"
        description={
          user?.role === 'admin'
            ? 'Kelola dan pantau request pembelian seluruh riset.'
            : 'Ajukan kebutuhan dan pantau proses pembelian Anda.'
        }
      />
      <RequestList />
    </>
  );
}

type EntityAction = { kind: 'create' } | { kind: 'edit' | 'delete'; id: string };

export function UsersPage() {
  const { data } = useDemo();
  const [query, setQuery] = useState('');
  const [descending, setDescending] = useState(false);
  const [pageValue, setPage] = useState(1);
  const [size, setSize] = useState(5);
  const [action, setAction] = useState<EntityAction | null>(null);
  const users = data.users
    .filter((user) =>
      `${user.name} ${user.identifier} ${user.email} ${user.researchIds.map((id) => data.research.find((item) => item.id === id)?.name ?? '').join(' ')}`
        .toLocaleLowerCase('id')
        .includes(query.toLocaleLowerCase('id').trim()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'id') * (descending ? -1 : 1));
  const page = Math.min(pageValue, Math.max(1, Math.ceil(users.length / size)));
  const editing =
    action && 'id' in action ? data.users.find((item) => item.id === action.id) : undefined;
  const close = () => setAction(null);
  return (
    <>
      <PageHeading
        eyebrow="Administrasi akses"
        title="Manajemen Pengguna"
        description="Kelola akun, peran, dan penugasan jenis riset."
        action={
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setAction({ kind: 'create' })}
          >
            <PlusIcon aria-hidden="true" />
            Tambah Pengguna
          </button>
        }
      />
      <section className={styles.contentCard} aria-label="Daftar pengguna">
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <MagnifyingGlassIcon aria-hidden="true" />
            <input
              type="search"
              aria-label="Cari pengguna"
              placeholder="Cari nama, NIP/NIM, email, atau riset..."
              value={query}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setPage(1);
              }}
            />
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setDescending((value) => !value)}
            aria-label={`Urutkan nama ${descending ? 'A ke Z' : 'Z ke A'}`}
          >
            <ArrowsUpDownIcon aria-hidden="true" />
            Urutkan nama
          </button>
        </div>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabel pengguna">
          <table className={styles.table}>
            <caption className="sr-only">Pengguna dan penugasan riset</caption>
            <thead>
              <tr>
                {[
                  'Nama lengkap',
                  'NIP/NIM',
                  'Email',
                  'Role',
                  'Jenis riset',
                  'Tanggal dibuat',
                  'Aksi',
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.slice((page - 1) * size, page * size).map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.identifier}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={styles.roleBadge} data-role={user.role}>
                      {user.role === 'admin' ? 'Admin' : 'Pengaju'}
                    </span>
                  </td>
                  <td>
                    {user.researchIds
                      .map((id) => data.research.find((item) => item.id === id)?.name)
                      .join(', ') || '—'}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.iconButton}
                        data-action="edit"
                        type="button"
                        aria-label={`Edit ${user.name}`}
                        onClick={() => setAction({ kind: 'edit', id: user.id })}
                      >
                        <PencilSquareIcon aria-hidden="true" />
                      </button>
                      <button
                        className={styles.iconButton}
                        data-action="delete"
                        type="button"
                        aria-label={`Hapus ${user.name}`}
                        title={
                          demoAccounts.some((item) => item.id === user.id)
                            ? 'Akun demo utama tidak dapat dihapus'
                            : 'Hapus pengguna'
                        }
                        disabled={demoAccounts.some((item) => item.id === user.id)}
                        onClick={() => setAction({ kind: 'delete', id: user.id })}
                      >
                        <TrashIcon aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className={styles.empty}>Tidak ada pengguna yang sesuai pencarian.</p>
          )}
        </div>
        <Pagination
          count={users.length}
          page={page}
          pageSize={size}
          onPage={setPage}
          onPageSize={(value) => {
            setSize(value);
            setPage(1);
          }}
        />
      </section>
      {action?.kind === 'create' && <UserEditor onClose={close} />}
      {action?.kind === 'edit' && editing && <UserEditor user={editing} onClose={close} />}
      {action?.kind === 'delete' && editing && (
        <ConfirmDialog
          title="Hapus Pengguna"
          description={`Hapus ${editing.name} dari data contoh? Pengguna yang masih dirujuk request tidak dapat dihapus.`}
          confirmLabel="Hapus Pengguna"
          onConfirm={() => deleteUser(editing.id)}
          onClose={close}
        />
      )}
    </>
  );
}

export function ResearchPage() {
  const { data } = useDemo();
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<EntityAction | null>(null);
  const allocation = data.research.reduce((sum, item) => sum.plus(item.allocated), new Decimal(0));
  const used = data.research.reduce(
    (sum, item) => sum.plus(researchUsed(data, item.id)),
    new Decimal(0),
  );
  const filtered = data.research.filter((item) =>
    `${item.name} ${item.description}`
      .toLocaleLowerCase('id')
      .includes(query.toLocaleLowerCase('id').trim()),
  );
  const editing =
    action && 'id' in action ? data.research.find((item) => item.id === action.id) : undefined;
  const close = () => setAction(null);
  return (
    <>
      <PageHeading
        eyebrow="Monitoring pendanaan"
        title="Jenis Riset"
        description="Pantau alokasi, pemakaian, dan sisa dana setiap proyek."
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setAction({ kind: 'create' })}
          >
            <PlusIcon aria-hidden="true" />
            Tambah Jenis Riset
          </button>
        }
      />
      <div className={styles.sectionHeading}>
        <h2>Rekap Dana Riset</h2>
        <p>Ringkasan alokasi dan request aktif pada data contoh.</p>
      </div>
      <section
        className={`${styles.stats} ${styles.fundingStats}`}
        aria-label="Ringkasan dana riset"
      >
        {[
          ['Total alokasi', allocation],
          ['Sudah digunakan', used],
          ['Sisa dana', allocation.minus(used)],
        ].map(([label, value]) => (
          <article className={styles.statCard} key={String(label)}>
            <div>
              <h3 className={styles.statLabel}>{String(label)}</h3>
              <p className={styles.fundingValue}>{formatMoney(String(value))}</p>
            </div>
            <span className={styles.statIcon}>
              <WalletIcon aria-hidden="true" />
            </span>
          </article>
        ))}
      </section>
      <div className={styles.search}>
        <MagnifyingGlassIcon aria-hidden="true" />
        <input
          type="search"
          aria-label="Cari jenis riset"
          placeholder="Cari jenis riset..."
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </div>
      <section className={styles.researchGrid} aria-label="Daftar jenis riset">
        {filtered.map((item) => {
          const spending = researchUsed(data, item.id);
          const percent = spending.div(item.allocated).times(100).toDecimalPlaces(0).toNumber();
          return (
            <article className={styles.researchCard} key={item.id}>
              <h2>{item.name}</h2>
              <p>
                {
                  data.requests.filter(
                    (request) => !request.deleted && request.researchId === item.id,
                  ).length
                }{' '}
                request tercatat · {percent}% terpakai
              </p>
              <progress value={percent} max={100} aria-label={`Pemakaian dana ${item.name}`} />
              <div className={styles.researchMoney}>
                <div>
                  <span>Terpakai</span>
                  <strong>{formatMoney(spending)}</strong>
                </div>
                <div>
                  <span>Sisa</span>
                  <strong>{formatMoney(new Decimal(item.allocated).minus(spending))}</strong>
                </div>
              </div>
              <div className={styles.researchActions}>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label={`Edit ${item.name}`}
                  onClick={() => setAction({ kind: 'edit', id: item.id })}
                >
                  <PencilSquareIcon aria-hidden="true" />
                </button>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label={`Hapus ${item.name}`}
                  onClick={() => setAction({ kind: 'delete', id: item.id })}
                >
                  <TrashIcon aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </section>
      {filtered.length === 0 && (
        <p className={styles.empty}>Tidak ada jenis riset yang sesuai pencarian.</p>
      )}
      {action?.kind === 'create' && <ResearchEditor onClose={close} />}
      {action?.kind === 'edit' && editing && <ResearchEditor research={editing} onClose={close} />}
      {action?.kind === 'delete' && editing && (
        <ConfirmDialog
          title="Hapus Jenis Riset"
          description={`Hapus ${editing.name}? Riset yang masih dirujuk request atau pengguna tidak dapat dihapus.`}
          confirmLabel="Hapus Jenis Riset"
          onConfirm={() => deleteResearch(editing.id)}
          onClose={close}
        />
      )}
    </>
  );
}
