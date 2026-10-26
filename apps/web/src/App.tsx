import { CubeTransparentIcon } from '@heroicons/react/24/outline';
import { Link, Outlet, Route, Routes } from 'react-router';
import { Button } from './components/ui/button';
import { LoginRoute, SessionGate, AdminGate } from './features/auth/session-routes';
import { DashboardShell } from './features/dashboard/shell';
import { DashboardPage, RequestsPage, UsersPage, ResearchPage } from './features/dashboard/pages';

function About() {
  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Tentang workspace</h1>
      <p className="leading-7 text-slate-600">
        Frontend berada di apps/web. Paket bersama dapat ditambahkan di packages, dan backend dapat
        disiapkan terpisah di apps/api.
      </p>
      <p className="leading-7 text-slate-600">
        Jalankan perintah dari root workspace. Rahasia backend tidak boleh disimpan pada variabel
        VITE_*.
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
      <h1 className="text-3xl font-bold">Halaman tidak ditemukan</h1>
      <Button asChild>
        <Link to="/">Kembali ke beranda</Link>
      </Button>
    </section>
  );
}

function WorkspaceLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-white focus:p-3"
        href="#konten"
      >
        Langsung ke konten
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <Link
            to="/"
            aria-label="STAS-RG beranda"
            className="flex items-center gap-2 rounded font-bold focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <CubeTransparentIcon aria-hidden="true" className="h-7 w-7" /> STAS-RG
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
            Frontend lokal
          </span>
        </div>
      </header>
      <main id="konten" className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginRoute />} />
      <Route element={<SessionGate />}>
        <Route element={<DashboardShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route element={<AdminGate />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/research-types" element={<ResearchPage />} />
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
