import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RabList } from './rab-list';
import { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import {
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShoppingCartIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { useDemo } from '../demo/use-demo';
import { dashboardSummary, deleteUser, deleteResearch } from '../demo/store';
import { formatMoney, formatDate, researchUsed } from '../demo/model';
import { demoAccounts } from '../demo/seed';
import { ConfirmDialog, PageHeading, Pagination } from './shared';
import { RequestList } from './request-list';
import { AdminDashboardNotice } from './admin-dashboard-notice';
import { ActionMenu } from './action-menu';
import { SortHeader } from './sort-header';
import { readSort, userColumns, sortParams, sortUsers, representedResearch } from './table-sorting';
import type { DemoUser } from '../demo/model';
import { useRecordNavigation, rememberScroll } from './record-navigation';
import styles from './dashboard.module.css';

const AdminAnalytics = lazy(() => import('./admin-analytics'));
const PersonalAnalytics = lazy(() => import('./personal-analytics'));

export function DashboardPage() {
  const { data, user } = useDemo();
  if (!user) return null;
  const summary = dashboardSummary(data, user);
  const cards = [
    {
      label: 'Total Request',
      value: String(summary.total),
      note: 'Seluruh pengajuan',
      icon: ShoppingCartIcon,
    },
    {
      label: 'Disetujui',
      value: String(summary.approved),
      note: 'Siap untuk proses pembelian',
      icon: CheckCircleIcon,
    },
    {
      label: 'Menunggu',
      value: String(summary.pending),
      note: 'Menunggu peninjauan Admin',
      icon: ClockIcon,
    },
    {
      label: 'Total Nilai',
      value: summary.value.gte(1000000)
        ? `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(summary.value.div(1000000).toNumber())} Jt`
        : formatMoney(summary.value),
      note: 'Nilai seluruh pengajuan',
      icon: ArrowTrendingUpIcon,
    },
  ];
  return (
    <>
      <PageHeading
        title="Dashboard"
        description={`Selamat datang, ${user.name}. Pantau Pembelian Barang riset Anda di sini.`}
        action={
          user.role === 'pengaju' ? (
            <Link className={styles.primaryButton} to="/requests?create=1">
              <PlusIcon aria-hidden="true" />
              Buat request
            </Link>
          ) : undefined
        }
      />
      <section className={styles.stats} aria-label="Ringkasan Pembelian Barang">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <article className={styles.statCard} key={label} aria-label={label}>
            <div>
              <h2 className={styles.statLabel}>{label}</h2>
              <p className={styles.statValue}>{value}</p>
              <p className={styles.statTrend}>{note}</p>
            </div>
            <span className={styles.statIcon}>
              <Icon aria-hidden="true" />
            </span>
          </article>
        ))}
      </section>
      {user.role === 'admin' && (
        <Suspense
          fallback={
            <section className={styles.analytics} aria-label="Memuat analitik">
              <div className={styles.chartPanel}>
                <p role="status">Memuat tren nilai…</p>
              </div>
              <div className={styles.chartPanel}>
                <p>Memuat peta urgensi…</p>
              </div>
            </section>
          }
        >
          <AdminAnalytics />
        </Suspense>
      )}
      {user.role === 'pengaju' && (
        <Suspense
          fallback={
            <section className={styles.agendaPanel} aria-label="Memuat analitik pribadi">
              <p role="status">Memuat kebutuhan barang…</p>
            </section>
          }
        >
          <PersonalAnalytics />
        </Suspense>
      )}
      <RequestList recent />
      {user.role === 'admin' && <AdminDashboardNotice />}
    </>
  );
}

export function RequestsPage() {
  const { user } = useDemo();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname === '/requests/rab' ? 'rab' : 'requests';
  return (
    <>
      <PageHeading
        title="Pembelian Barang"
        description={
          user?.role === 'admin'
            ? 'Kelola dan pantau Pembelian Barang seluruh riset.'
            : 'Ajukan kebutuhan dan pantau proses pembelian Anda.'
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(params);
          next.delete('page');
          void navigate(
            `${value === 'rab' ? '/requests/rab' : '/requests'}${next.size ? `?${next}` : ''}`,
          );
        }}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="requests">Pembelian Barang</TabsTrigger>
          <TabsTrigger value="rab">RAB</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <RequestList />
        </TabsContent>
        <TabsContent value="rab">
          <RabList />
        </TabsContent>
      </Tabs>
    </>
  );
}

type EntityAction = { kind: 'delete'; id: string };

function ResearchAssignments({ user }: { user: DemoUser }) {
  const { data } = useDemo();
  const { link } = useRecordNavigation('/users');
  const names = representedResearch(user, data);
  return (
    <>
      <span className={styles.researchNames}>{names.slice(0, 2).join(', ') || '—'}</span>
      {names.length > 2 && (
        <Link
          className={styles.inlineButton}
          aria-label={`Lihat semua perwakilan riset ${user.name}`}
          to={link(`/users/${user.id}`)}
        >
          +{names.length - 2} riset
        </Link>
      )}
    </>
  );
}
const userHeaders = [
  ['name', 'Nama lengkap'],
  ['identifier', 'NIP/NIM'],
  ['email', 'Email'],
  ['role', 'Peran'],
  ['research', 'Perwakilan riset'],
  ['createdAt', 'Tanggal dibuat'],
] as const;

export function UsersPage() {
  const { data } = useDemo();
  const { link } = useRecordNavigation('/users');
  const [params, setParams] = useSearchParams();
  const [action, setAction] = useState<EntityAction | null>(null);
  const query = params.get('q') ?? '';
  const sort = readSort(params, userColumns, 'name', 'asc');
  const requestedSize = Number(params.get('size'));
  const size = [5, 10, 20].includes(requestedSize) ? requestedSize : 5;
  const users = sortUsers(
    data.users.filter((user) =>
      `${user.name} ${user.identifier} ${user.email} ${representedResearch(user, data).join(' ')}`
        .toLocaleLowerCase('id')
        .includes(query.toLocaleLowerCase('id').trim()),
    ),
    data,
    sort.key,
    sort.direction,
  );
  const requestedPage = Number(params.get('page'));
  const page = Math.max(
    1,
    Math.min(
      Number.isInteger(requestedPage) ? requestedPage : 1,
      Math.max(1, Math.ceil(users.length / size)),
    ),
  );
  const editing =
    action && 'id' in action ? data.users.find((item) => item.id === action.id) : undefined;
  const close = () => setAction(null);
  function choose(next: EntityAction) {
    setAction(next);
  }
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }
  return (
    <>
      <PageHeading
        title="Manajemen Pengguna"
        description="Kelola akun, peran, dan perwakilan riset."
        action={
          <Link className={styles.primaryButton} to={link('/users/new')} onClick={rememberScroll}>
            <PlusIcon aria-hidden="true" />
            Tambah Pengguna
          </Link>
        }
      />
      <section className={styles.dataPanel} aria-label="Daftar pengguna">
        <div className={styles.filters}>
          <div className={styles.search}>
            <MagnifyingGlassIcon aria-hidden="true" />
            <input
              type="search"
              aria-label="Cari pengguna"
              placeholder="Cari nama, NIP/NIM, email, atau riset…"
              value={query}
              onInput={(event) => update('q', event.currentTarget.value)}
            />
          </div>
        </div>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabel pengguna">
          <table className={`${styles.table} ${styles.usersTable}`}>
            <caption className="sr-only">Pengguna dan perwakilan riset</caption>
            <thead>
              <tr>
                {userHeaders.map(([key, label]) => (
                  <SortHeader
                    key={key}
                    label={label}
                    active={sort.key === key}
                    direction={sort.direction}
                    onSort={() =>
                      setParams(sortParams(params, key, sort.key, sort.direction), {
                        replace: true,
                      })
                    }
                  />
                ))}
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.slice((page - 1) * size, page * size).map((user) => (
                <tr key={user.id}>
                  <td className={styles.itemCell}>
                    <Link className={styles.textLink} to={link(`/users/${user.id}`)}>
                      {user.name}
                    </Link>
                  </td>
                  <td>{user.identifier}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={styles.roleBadge} data-role={user.role}>
                      {user.role === 'admin' ? 'Admin' : 'Pengaju'}
                    </span>
                  </td>
                  <td>
                    <ResearchAssignments user={user} />
                  </td>
                  <td className={styles.dateCell}>{formatDate(user.createdAt)}</td>
                  <td>
                    <ActionMenu
                      label={`Aksi ${user.name}`}
                      items={[
                        {
                          label: `Edit ${user.name}`,
                          to: link(`/users/${user.id}/edit`),
                        },
                        {
                          label: `Hapus ${user.name}`,
                          danger: true,
                          disabled: demoAccounts.some((account) => account.id === user.id),
                          hint: 'Akun demo utama tidak dapat dihapus',
                          onSelect: () => choose({ kind: 'delete', id: user.id }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className={styles.empty}>
              <strong>Tidak ada pengguna yang sesuai.</strong>
              <p>Coba nama atau email lainnya.</p>
            </div>
          )}
        </div>
        <Pagination
          count={users.length}
          page={page}
          pageSize={size}
          onPage={(value) => update('page', String(value))}
          onPageSize={(value) => update('size', String(value))}
        />
      </section>
      {action?.kind === 'delete' && editing && (
        <ConfirmDialog
          title="Hapus Pengguna"
          description={`Hapus ${editing.name} dari data contoh? Pengguna yang masih dirujuk request tidak dapat dihapus.`}
          confirmLabel="Hapus Pengguna"
          onConfirm={() => {
            deleteUser(editing.id);
            toast.success('Pengguna berhasil dihapus.');
          }}
          onClose={close}
        />
      )}
    </>
  );
}

export function ResearchPage() {
  const { data } = useDemo();
  const { link } = useRecordNavigation('/research-types');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };
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
  function choose(next: EntityAction) {
    setAction(next);
  }
  return (
    <>
      <PageHeading
        title="Jenis Riset"
        description="Pantau alokasi, pemakaian, dan sisa dana setiap proyek."
        action={
          <Link
            className={styles.primaryButton}
            to={link('/research-types/new')}
            onClick={rememberScroll}
          >
            <PlusIcon aria-hidden="true" />
            Tambah Jenis Riset
          </Link>
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
          ['Dana berkomitmen', used],
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
          placeholder="Cari jenis riset…"
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
              <h2>
                <Link className={styles.textLink} to={link(`/research-types/${item.id}`)}>
                  {item.name}
                </Link>
              </h2>
              <p>
                {
                  data.requests.filter(
                    (request) => !request.deleted && request.researchId === item.id,
                  ).length
                }{' '}
                request tercatat · {percent}% terikat
              </p>
              <progress value={percent} max={100} aria-label={`Komitmen dana ${item.name}`} />
              <div className={styles.researchMoney}>
                <div>
                  <span>Komitmen</span>
                  <strong>{formatMoney(spending)}</strong>
                </div>
                <div>
                  <span>Sisa</span>
                  <strong>{formatMoney(new Decimal(item.allocated).minus(spending))}</strong>
                </div>
              </div>
              <div className={styles.researchActions}>
                <ActionMenu
                  label={`Aksi ${item.name}`}
                  items={[
                    {
                      label: `Edit ${item.name}`,
                      to: link(`/research-types/${item.id}/edit`),
                    },
                    {
                      label: `Hapus ${item.name}`,
                      danger: true,
                      onSelect: () => choose({ kind: 'delete', id: item.id }),
                    },
                  ]}
                />
              </div>
            </article>
          );
        })}
      </section>
      {filtered.length === 0 && (
        <p className={styles.empty}>Tidak ada jenis riset yang sesuai pencarian.</p>
      )}
      {action?.kind === 'delete' && editing && (
        <ConfirmDialog
          title="Hapus Jenis Riset"
          description={`Hapus ${editing.name}? Riset yang masih dirujuk request atau pengguna tidak dapat dihapus.`}
          confirmLabel="Hapus Jenis Riset"
          onConfirm={() => {
            deleteResearch(editing.id);
            toast.success('Jenis riset berhasil dihapus.');
          }}
          onClose={close}
        />
      )}
    </>
  );
}
