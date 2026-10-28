import { ReplacementPage } from './features/dashboard/replacement';
import logoUrl from '../../../assets/img/logo-stas-rg.png';
import { Link, Outlet, Route, Routes, Navigate, useLocation } from 'react-router';
import { Button } from './components/ui/button';
import { LoginRoute, SessionGate, AdminGate } from './features/auth/session-routes';
import { legacyDestination } from './features/dashboard/legacy-navigation';
import {
  RequestRecordPage,
  UserRecordPage,
  ResearchRecordPage,
  RabRecordPage,
  ProfilePage,
  NotificationsPage,
} from './features/dashboard/resource-pages';
import { DashboardShell } from './features/dashboard/shell';
import { DashboardPage, RequestsPage, UsersPage, ResearchPage } from './features/dashboard/pages';

function About() {
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Tentang STAS-RG</h1>
      <p className="leading-7">
        Portal Pembelian Barang riset STAS-RG membantu Pengaju mengajukan kebutuhan dan memantau
        proses pembelian, serta membantu Admin meninjau dan mengelola Pembelian Barang.
      </p>
      <p className="leading-7">
        Mode demo menggunakan data contoh yang tersimpan selama tab terbuka. Data dan pemeriksaan
        akses pada demo ini merupakan simulasi frontend.
      </p>
      <Button asChild>
        <Link to="/">Kembali ke beranda</Link>
      </Button>
    </section>
  );
}

function NotFound() {
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
      <Button asChild>
        <Link to="/">Kembali ke beranda</Link>
      </Button>
    </section>
  );
}

function WorkspaceLayout() {
  return (
    <div className="min-h-screen bg-[var(--ui-canvas)] text-[var(--ui-ink)]">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-white focus:p-3"
        href="#konten"
      >
        Langsung ke konten
      </a>
      <header className="border-b border-[var(--ui-border)] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <Link
            to="/"
            aria-label="STAS-RG beranda"
            className="flex items-center gap-2 rounded font-bold focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <img src={logoUrl} alt="" width={28} height={34} /> STAS-RG
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">Mode demo</span>
        </div>
      </header>
      <main id="konten" className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <Outlet />
      </main>
    </div>
  );
}

function DeliveryRedirect() {
  const location = useLocation();
  return (
    <Navigate replace to={`${location.pathname.replace(/\/delivery$/, '')}${location.search}`} />
  );
}

export function App() {
  const location = useLocation();
  const legacy = legacyDestination(location.pathname, location.search);
  if (legacy) return <Navigate to={legacy} replace />;
  return (
    <Routes>
      <Route path="/" element={<LoginRoute />} />
      <Route element={<SessionGate />}>
        <Route element={<DashboardShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/requests/new" element={<RequestRecordPage mode="new" />} />
          <Route path="/requests/rab" element={<RequestsPage />} />
          <Route path="/requests/rab/import" element={<RabRecordPage importing />} />
          <Route path="/requests/rab/:rabId" element={<RabRecordPage />} />
          <Route path="/requests/:requestId" element={<RequestRecordPage />} />
          <Route
            path="/requests/:requestId/invoice"
            element={<RequestRecordPage mode="invoice" />}
          />
          <Route path="/requests/:requestId/edit" element={<RequestRecordPage mode="edit" />} />
          <Route path="/requests/:requestId/replacement" element={<ReplacementPage />} />
          <Route path="/requests/:requestId/status" element={<RequestRecordPage mode="status" />} />
          <Route path="/requests/:requestId/delivery" element={<DeliveryRedirect />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route element={<AdminGate />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/new" element={<UserRecordPage mode="new" />} />
            <Route path="/users/:userId" element={<UserRecordPage />} />
            <Route path="/users/:userId/edit" element={<UserRecordPage mode="edit" />} />
            <Route path="/research-types" element={<ResearchPage />} />
            <Route path="/research-types/new" element={<ResearchRecordPage mode="new" />} />
            <Route path="/research-types/:researchId" element={<ResearchRecordPage />} />
            <Route
              path="/research-types/:researchId/edit"
              element={<ResearchRecordPage mode="edit" />}
            />
          </Route>
        </Route>
      </Route>
      <Route element={<WorkspaceLayout />}>
        <Route path="/tentang" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
