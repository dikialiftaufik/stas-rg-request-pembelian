# STAS-RG Request Pembelian

Workspace monorepo untuk frontend STAS-RG pada Windows, tanpa Docker.

## Mulai bekerja

Gunakan Node **24.22.1** dan pnpm **12.15.0**. Untuk checkout baru, buka PowerShell lalu jalankan:

```powershell
git clone https://github.com/dikialiftaufik/stas-rg-request-pembelian.git
Set-Location -LiteralPath 'stas-rg-request-pembelian'
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Buka http://127.0.0.1:5173 dan biarkan terminal tetap berjalan. Hentikan dengan Ctrl+C.

Node yang digunakan **24.22.1**, pnpm **12.15.0**. Node sudah tersedia; pnpm diperbarui dari 12.10.1 saat setup. Versi dependency langsung dipin exact di manifest dan pnpm-lock.yaml.

## Struktur

```text
apps/web/             React + Vite + Refine SPA
packages/             Tempat paket bersama di tahap berikutnya
docs/                 Dokumentasi lokal, dikecualikan dari Git
visual-references/    Referensi yang sudah ada sebelum setup, tidak diubah
```

Backend belum dibuat. Nantinya backend dapat ditempatkan di apps/api, sesuai keputusan monorepo tim.

## Perintah dari root

| Perintah                           | Kegunaan                                                   |
| ---------------------------------- | ---------------------------------------------------------- |
| pnpm.cmd dev                       | Menjalankan frontend                                       |
| pnpm.cmd typecheck                 | Memeriksa TypeScript strict                                |
| pnpm.cmd lint                      | Memeriksa ESLint, React, aksesibilitas dan aturan keamanan |
| pnpm.cmd format:check              | Memeriksa format tanpa mengubah file                       |
| pnpm.cmd format                    | Merapikan format; tinjau perubahan sesudahnya              |
| pnpm.cmd test:unit                 | Menjalankan test fondasi dan komponen                      |
| pnpm.cmd test:coverage             | Menjalankan test dengan threshold frontend 70%             |
| pnpm.cmd build                     | Membuat frontend produksi ke apps/web/dist                 |
| pnpm.cmd test:e2e                  | Build lalu uji browser dan aksesibilitas dengan Playwright |
| pnpm.cmd check                     | Format check, lint, typecheck, unit test dan build         |
| pnpm.cmd install --frozen-lockfile | Memasang ulang persis dari lockfile saat checkout baru     |

Browser Playwright hanya perlu diunduh pada mesin baru:

```powershell
pnpm.cmd --filter @stas/web exec playwright install chromium
```

## Yang disiapkan

- React 19.3, Vite 8.3, TypeScript 6.0.3 strict, Tailwind 4.3.
- Refine 5, React Router 7, TanStack Query/Table, React Hook Form, Zod.
- Heroicons, Sonner, Recharts, Day Picker, font lokal, Decimal dan date utilities.
- Radix Slot dan fondasi Button copy-in dengan konfigurasi CLI shadcn yang dipin.
- ESLint, Prettier, Vitest/Testing Library, MSW, Playwright/axe dan Turborepo.
- Halaman login responsif sesuai visual-references/login.png, dengan validasi form dan tombol tampilkan password.

Versi dependency dan integrity tercatat di pnpm-lock.yaml; patch dan override berada di patches/ dan pnpm-workspace.yaml. Catatan baseline tambahan tersedia secara lokal di docs/dependency-baseline.json, yang dikecualikan dari Git. Paket pendamping yang tidak dipin spesifikasi dipilih setelah pemeriksaan metadata dan kecocokan Node/peer.

## Konfigurasi public

Lihat apps/web/.env.example. Berkas lokal apps/web/.env.local tidak masuk Git.

- VITE_API_BASE_URL default /api/v1, belum berarti backend tersedia.
- VITE_ENABLE_MOCKS default false; MSW hanya boleh dimulai pada mode development.
- Jangan simpan password, BETTER_AUTH_SECRET, credential database/S3, atau key enkripsi pada VITE_*.

MSW menyediakan contoh endpoint tiruan /api/v1/setup yang memberi label mock dengan jelas. Autentikasi dan data produksi belum diimplementasikan.

## Halaman login

URL / menampilkan halaman login. Field identitas menerima ID, NIM, atau email; kedua field wajib diisi. Submit valid menampilkan pesan "Fitur masuk belum tersedia saat ini." tanpa mengirim kredensial, membuat sesi, atau berpindah ke dashboard. Integrasi autentikasi backend akan ditambahkan terpisah.

Pada layar mulai 1024 px, halaman menampilkan form dan panel identitas STAS-RG. Layar lebih kecil menampilkan form saja. Route /tentang dan halaman tidak ditemukan tetap tersedia. Screenshot berbagai ukuran layar disimpan sebagai lampiran laporan Playwright saat menjalankan pnpm.cmd test:e2e.

## Komponen dan integrasi berikutnya

Alias @/ sudah mengarah ke src pada Vite dan TypeScript. Konfigurasi components.json disiapkan untuk komponen copy-in. Ikon produk tetap Heroicons; tinjau generator sebelum menambah komponen yang memakai ikon lain. Semua dependency baru harus dipin exact.

Provider REST awal belum menerapkan seluruh envelope/cursor/otorisasi API STAS-RG. Sesuaikan bersama kontrak backend sebelum membangun halaman data. Auth browser nanti memakai cookie HttpOnly dari backend, bukan token localStorage.

## Catatan versi

Spesifikasi TS-STAS-001 v1.0.0 merupakan baseline. Kebijakan update non-keamanan memakai cooldown tiga hari, dan major upgrade memerlukan keputusan tim. React Hook Form 7.91.0 baru dirilis pada 24 Oktober 2026 pukul 04.37 WIB; versi tersebut diadopsi pada bootstrap karena merupakan baseline 7.91.x yang diminta, bukan upgrade dependency yang sebelumnya terpasang. Catatan umur rilis disimpan pada baseline dan perlu diperhatikan saat review keamanan berikutnya.

Tidak ada Docker, WSL, database, backend, SSO atau layanan cloud yang dipasang pada setup frontend ini. Hasil verifikasi aktual dicatat terpisah setelah pemeriksaan selesai.

## Penyesuaian kompatibilitas

MSW 3 memakai onUnhandledFrame. Vitest memakai satu konteks router bersama. Plugin aksesibilitas lama dijembatani ke API/AST ESLint 10 tanpa menonaktifkan rule heading; heading kosong tetap ditolak.

Decoder turunan Refine diperbarui ke decode-uri-component 0.5.0 dengan patch interop query-string 7.1.3; versi Refine tetap 5.0.x dan simple-rest tetap 6.0.x. Patch dan override wajib dipertahankan bersama lockfile. Audit sesudah perbaikan tidak menemukan advisory.

## Hasil verifikasi

Jalankan pnpm.cmd check dan pnpm.cmd test:e2e untuk memverifikasi checkout. Laporan setup tambahan tersedia secara lokal di docs/hasil-setup.md, yang dikecualikan dari Git.
