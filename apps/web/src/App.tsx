import { CheckCircleIcon, CubeTransparentIcon } from '@heroicons/react/24/outline';
import { Link, Route, Routes } from 'react-router';
import { toast } from 'sonner';
import { Button } from './components/ui/button';

function Welcome() {
  return (
    <section aria-labelledby="welcome-title" className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
        <CheckCircleIcon aria-hidden="true" className="h-5 w-5" /> Lingkungan frontend
      </div>
      <h1 id="welcome-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
        Frontend STAS-RG siap
      </h1>
      <p className="max-w-2xl leading-7 text-slate-600">
        Kerangka React, Vite, TypeScript, Refine dan Tailwind berjalan langsung di Windows. Mulai
        pengembangan dari workspace ini tanpa Docker.
      </p>
      <ul className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <li>React 19 dan TypeScript strict</li>
        <li>Refine 5 dan React Router 7</li>
        <li>Tailwind 4 dan Heroicons</li>
        <li>Vitest dan Playwright</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => toast.success('Notifikasi frontend bekerja.')}>
          Uji notifikasi
        </Button>
        <Button variant="outline" asChild>
          <Link to="/tentang">Tentang workspace</Link>
        </Button>
      </div>
      <p className="text-sm leading-6 text-slate-600">
        Ini halaman pemeriksaan awal. Login, pengajuan dan data produksi belum dihubungkan ke
        backend.
      </p>
    </section>
  );
}

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

export function App() {
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
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/tentang" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
