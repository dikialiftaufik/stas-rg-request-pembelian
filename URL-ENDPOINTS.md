# Referensi URL dan Endpoint STAS-RG Pembelian Barang

Dokumen ini memetakan URL yang benar-benar tersedia pada aplikasi, berdasarkan source kerja dengan baseline commit `0963ac67b718e6075da8be1c7f961512c932315c` dan pembaruan penawaran pengganti, diperiksa pada **28 Oktober 2026**.

**Temuan utama:** aplikasi mempunyai **24 pola rute halaman**, **1 fallback halaman tidak ditemukan**, dan **1 handler HTTP mock untuk pengembangan/pengujian**. Login, CRUD, invoice, RAB, notifikasi, dan analitik bisnis saat ini menggunakan simulasi lokal di browser; belum menggunakan API backend produksi.

Contoh `/requests` adalah **rute halaman React**, bukan endpoint REST untuk mengambil atau menyimpan JSON. Dokumen ini memisahkan keduanya agar URL halaman tidak disalahartikan sebagai kontrak API server.

## Daftar isi

1. [Alamat dasar dan istilah](#1-alamat-dasar-dan-istilah)
2. [Aturan akses bersama](#2-aturan-akses-bersama)
3. [Daftar lengkap rute halaman](#3-daftar-lengkap-rute-halaman)
4. [Parameter URL](#4-parameter-url)
5. [Nilai status dan ID contoh](#5-nilai-status-dan-id-contoh)
6. [Kompatibilitas URL lama](#6-kompatibilitas-url-lama)
7. [Endpoint HTTP yang didefinisikan](#7-endpoint-http-yang-didefinisikan)
8. [Pemetaan aksi bisnis ke operasi lokal](#8-pemetaan-aksi-bisnis-ke-operasi-lokal)
9. [Dokumen, unduhan, dan aset](#9-dokumen-unduhan-dan-aset)
10. [Contoh alur URL](#10-contoh-alur-url)
11. [Sumber kode dan batas dokumentasi](#11-sumber-kode-dan-batas-dokumentasi)

## 1. Alamat dasar dan istilah

| Konteks                           | Alamat atau nilai                                           | Keterangan                                                                                                   |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Frontend development              | `http://127.0.0.1:5173`                                     | Alamat dari script `dev` aplikasi web.                                                                       |
| Frontend production preview lokal | `http://127.0.0.1:4173`                                     | Alamat script `preview`; juga digunakan Playwright.                                                          |
| Prefix API yang dikonfigurasi     | `/api/v1`                                                   | Nilai default `VITE_API_BASE_URL`; bukan bukti bahwa server API sudah tersedia.                              |
| Sakelar mock                      | `VITE_ENABLE_MOCKS=false`                                   | Nilai dalam `.env.example`; worker browser hanya dimulai ketika development **dan** sakelar bernilai `true`. |
| Alamat deployment produksi        | Belum ditetapkan dalam konfigurasi yang dirujuk dokumen ini | Jangan menganggap alamat preview lokal sebagai domain produksi.                                              |

URL lengkap halaman dibentuk dengan menggabungkan alamat frontend dan path, misalnya:

```text
http://127.0.0.1:5173/requests
http://127.0.0.1:5173/requests/request-1
```

Istilah dalam dokumen:

- **Rute halaman / SPA:** URL yang dirender React Router. Navigasi melalui tautan aplikasi biasanya tidak memuat ulang seluruh dokumen HTML.
- **Endpoint HTTP:** kombinasi method dan URL yang mempunyai handler permintaan/respons. Hanya handler mock pada bagian 7 yang didefinisikan dalam source aplikasi saat ini.
- **Operasi lokal:** fungsi TypeScript yang membaca atau mengubah snapshot, SessionStorage, atau IndexedDB. Operasi ini tidak mempunyai method `POST`, `PATCH`, atau `DELETE` HTTP.
- **Parameter path:** bagian dinamis seperti `:requestId`; ganti dengan ID data yang tersedia.
- **Query parameter:** pengaturan setelah `?`, misalnya `?status=pending_review&page=2`.

## 2. Aturan akses bersama

| Kondisi                                                                  | Perilaku saat ini                                                                                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Belum login membuka rute terlindungi                                     | `SessionGate` mengarahkan ke `/` dengan navigasi `replace`. Tujuan sebelumnya tidak otomatis disimpan sebagai redirect setelah login.                                |
| Sudah login membuka `/`                                                  | `LoginRoute` mengarahkan ke `/dashboard`.                                                                                                                            |
| Login berhasil                                                           | Akun aktif disimpan dalam snapshot lokal, lalu pengguna menuju `/dashboard`.                                                                                         |
| Login gagal                                                              | Tetap pada login dengan pesan `Email atau password salah.`; tidak ada endpoint login server.                                                                         |
| Pengaju membuka halaman Admin                                            | Halaman menampilkan `Akses ditolak`; bukan respons HTTP `403` dari backend.                                                                                          |
| ID request tidak ditemukan, sudah dihapus, atau di luar cakupan pengguna | Halaman pemulihan data tidak tersedia ditampilkan. Pada halaman record request, pemeriksaan keberadaan/cakupan data dilakukan sebelum pemeriksaan mode khusus Admin. |
| Logout                                                                   | Menghapus identitas sesi aktif dan cache terkait pengguna, lalu kembali ke `/`; data demo dan dokumen pada tab yang sama tetap tersedia.                             |
| Refresh                                                                  | Membaca kembali snapshot dan dokumen lokal yang masih tersedia; tidak mengambil data dari backend.                                                                   |

Admin melihat semua request yang belum dihapus. Pengaju hanya melihat request miliknya, meskipun beberapa akun dapat mewakili riset yang sama. Setiap akun Pengaju baru/yang diedit harus mewakili tepat satu riset; form pengajuan mengambil riset dari profil secara otomatis.

Pemeriksaan peran pada rute dilengkapi pemeriksaan pada fungsi mutasi/pembacaan dokumen. Seluruh mekanisme tersebut tetap merupakan simulasi browser, bukan otorisasi server produksi.

## 3. Daftar lengkap rute halaman

Semua entri berikut adalah **rute frontend**, bukan endpoint CRUD HTTP. Membuka path langsung memerlukan frontend/hosting SPA yang menyajikan aplikasi pada path tersebut. Kode aplikasi tidak menetapkan status HTTP `401`, `403`, atau `404` untuk halaman akses ditolak/data tidak tersedia.

### 3.1 Login, dashboard, dan halaman bersama

| No. | Pola URL         | Akses             | Fungsi dan perilaku                                                                                                                                                                                         |
| --- | ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`              | Publik            | Halaman login. Pengguna yang mempunyai sesi aktif dialihkan ke `/dashboard`.                                                                                                                                |
| 2   | `/dashboard`     | Admin dan Pengaju | Ringkasan sesuai peran, dua grafik sesuai peran, dan lima request terbaru dalam cakupan pengguna. Popup Admin hanya dipertimbangkan sekali per sesi login dan tampil jika ada request menunggu persetujuan. |
| 3   | `/profile`       | Admin dan Pengaju | Menampilkan informasi akun aktif serta tombol keluar; bukan editor profil umum.                                                                                                                             |
| 4   | `/notifications` | Admin dan Pengaju | Daftar notifikasi akun aktif, penandaan dibaca, dan tautan menuju request terkait.                                                                                                                          |
| 5   | `/tentang`       | Publik            | Penjelasan portal dan batas mode demo, menggunakan layout halaman pendukung.                                                                                                                                |
| —   | `*`              | Publik            | Fallback untuk path yang tidak cocok: halaman `Halaman tidak ditemukan`. Tanda `*` adalah pola pencocokan, bukan URL literal yang perlu dibuka.                                                             |

### 3.2 Pembelian Barang

| No. | Pola URL                           | Akses                                | Fungsi dan syarat                                                                                                                                                                                                                        |
| --- | ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | `/requests`                        | Admin dan Pengaju                    | Daftar request sesuai cakupan, pencarian, filter status/riset/periode, sorting, dan pagination. Ekspor Excel hanya tersedia bagi Admin di halaman ini. Status pengajuan dapat diubah langsung oleh Admin pada sel tabel.                 |
| 7   | `/requests/new`                    | Pengaju                              | Membuat request manual atau dari barang RAB aktif. Admin yang membuka rute ini mendapat halaman akses ditolak. Riset mengikuti profil akun; mode RAB meminta dokumen dan barang dari riset tersebut.                                     |
| 8   | `/requests/:requestId`             | Admin; Pengaju pemilik               | Detail barang, nilai request, status pengajuan, linimasa pembelian, riwayat, invoice, sumber RAB, serta cabang penawaran pengganti. Admin dapat mengubah status pengajuan langsung pada detail.                                          |
| 9   | `/requests/:requestId/edit`        | Admin                                | Mengedit data barang/request melalui halaman form. Validasi tanggal dan alokasi tetap diterapkan sesuai operasi yang berubah.                                                                                                            |
| 10  | `/requests/:requestId/status`      | Admin                                | Mengubah **tahapan pembelian** melalui transisi yang diizinkan. Berbeda dari status pengajuan administratif. Penolakan membutuhkan alasan; penyelesaian membutuhkan invoice lengkap dan dokumen yang valid.                              |
| 11  | `/requests/:requestId/invoice`     | Admin; Pengaju pemilik untuk membaca | Melihat dokumen dan metadata invoice. Admin dapat menyimpan/mengganti invoice sejak Disetujui hingga Selesai. Pengaju tidak dapat mengunggah atau mengubah. Request yang belum memenuhi tahap menampilkan informasi tanpa editor unggah. |
| 12  | `/requests/:requestId/delivery`    | Admin dan Pengaju pemilik            | URL kompatibilitas: dialihkan ke detail request dengan query tetap tersedia; tidak ada editor pengiriman.                                                                                                                                |
| 13  | `/requests/:requestId/replacement` | Admin; Pengaju pemilik               | Admin mengajukan tautan dan harga pengganti sebelum pengiriman; Pengaju membandingkan, menyetujui, atau meminta alternatif dengan alasan. Tahap utama dijeda sampai disetujui.                                                           |

Contoh ID request bawaan: `request-1`, `request-2`, dan seterusnya. Request baru memakai ID yang dibuat aplikasi. ID bukan nomor invoice dan tidak menentukan hak akses.

### 3.3 Rencana Anggaran Biaya (RAB)

| No. | Pola URL               | Akses                         | Fungsi dan syarat                                                                                                                                                                                                                                                              |
| --- | ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14  | `/requests/rab`        | Admin dan Pengaju             | Katalog RAB. Default menampilkan versi aktif; Admin dapat memilih semua versi. Pengaju melihat versi aktif untuk riset perwakilannya. Daftar diurutkan berdasarkan tanggal pembuatan terbaru.                                                                                  |
| 15  | `/requests/rab/import` | Admin                         | Mengimpor CSV/XLSX/PDF, memilih worksheet/pemetaan kolom bila relevan, memeriksa/mengoreksi barang, lalu mengonfirmasi versi baru. Tahap impor berada pada halaman yang sama dan tidak mempunyai URL terpisah.                                                                 |
| 16  | `/requests/rab/:rabId` | Admin; Pengaju yang diizinkan | Detail versi RAB, tabel barang, pencarian/sorting/pagination, dan pratinjau dokumen sumber. Pengaju dapat membuka RAB aktif risetnya atau versi lama yang dirujuk request miliknya yang belum dihapus. Aksi `Ajukan barang ini` hanya tersedia untuk Pengaju pada versi aktif. |

Satu riset mempunyai satu RAB aktif. Impor baru mengarsipkan versi sebelumnya; referensi pada request lama tetap menunjuk versi asal. Tidak ada rute edit atau hapus RAB dalam router saat ini.

### 3.4 Manajemen pengguna

| No. | Pola URL              | Akses | Fungsi dan syarat                                                                                                              |
| --- | --------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| 17  | `/users`              | Admin | Daftar pengguna dengan pencarian, sorting header, pagination, dan aksi pengelolaan.                                            |
| 18  | `/users/new`          | Admin | Menambah data pengguna: nama, NIP/NIM, email, peran, dan riset perwakilan. Penambahan ini tidak membuat kredensial login baru. |
| 19  | `/users/:userId`      | Admin | Detail pengguna dan daftar lengkap riset yang diwakili.                                                                        |
| 20  | `/users/:userId/edit` | Admin | Mengedit pengguna. Email/peran kedua akun login demo utama tetap dilindungi.                                                   |

Penghapusan pengguna dilakukan melalui aksi daftar dan dialog konfirmasi, tanpa rute hapus tersendiri. Pengguna yang masih dirujuk request atau merupakan akun demo utama tidak dapat dihapus.

### 3.5 Jenis riset

| No. | Pola URL                           | Akses | Fungsi dan syarat                                                                                                                              |
| --- | ---------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | `/research-types`                  | Admin | Ringkasan alokasi/komitmen/sisa dana, pencarian, dan daftar riset. Halaman ini tidak menyediakan parameter pagination atau sorting tersendiri. |
| 22  | `/research-types/new`              | Admin | Menambah nama, deskripsi, dan alokasi riset.                                                                                                   |
| 23  | `/research-types/:researchId`      | Admin | Detail riset, alokasi/komitmen/sisa dana, serta tautan ke request dan RAB terkait.                                                             |
| 24  | `/research-types/:researchId/edit` | Admin | Mengedit riset; alokasi tidak boleh lebih kecil daripada nilai yang sudah berkomitmen.                                                         |

Penghapusan dilakukan dari aksi daftar dengan konfirmasi. Riset yang masih dirujuk request, pengguna, atau dokumen RAB tidak dapat dihapus. Tidak ada URL `/research-types/:researchId/delete` dalam router.

## 4. Parameter URL

Query parameter mengatur tampilan atau konteks navigasi; parameter tersebut tidak memberikan hak akses tambahan. Semua filter tetap bekerja pada data yang diizinkan bagi akun aktif.

### 4.1 Daftar Pembelian Barang: `/requests`

| Parameter  | Nilai/default                                                                                                           | Efek                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`        | Teks; default kosong                                                                                                    | Mencari nama barang, nama pengaju, atau nama riset, tanpa membedakan huruf besar/kecil. Nomor invoice belum termasuk pencarian teks ini.       |
| `status`   | Salah satu kode tahapan pembelian; default semua                                                                        | Memfilter `request.status`. Nilai yang tidak valid diabaikan. Ini bukan filter status pengajuan administratif.                                 |
| `research` | ID riset, misalnya `smart`; default semua dalam cakupan                                                                 | Memfilter riset. ID yang tidak dikenal tidak dijadikan filter. Pengaju tetap dibatasi pada request miliknya.                                   |
| `from`     | `YYYY-MM-DD`                                                                                                            | Tanggal awal pengajuan, inklusif dalam WIB.                                                                                                    |
| `to`       | `YYYY-MM-DD`                                                                                                            | Tanggal akhir pengajuan, inklusif dalam WIB. Harus tersedia bersama `from` dan tidak lebih awal dari tanggal awal.                             |
| `sortBy`   | `item`, `owner`, `research`, `quantity`, `total`, `status`, `submissionStatus`, `createdAt`, `invoice`, `invoiceNumber` | Kolom pengurutan. Default tanpa parameter sorting yang valid adalah `createdAt` menurun.                                                       |
| `sortDir`  | `asc` atau `desc`                                                                                                       | Arah sorting ketika `sortBy` valid. Jika `sortBy` valid tetapi `sortDir` tidak diberikan/tidak bernilai `desc`, arah yang dibaca adalah `asc`. |
| `page`     | Bilangan bulat mulai `1`; default `1`                                                                                   | Halaman aktif, dibatasi ke rentang halaman yang tersedia. Nilai bukan bilangan bulat kembali ke halaman pertama.                               |
| `size`     | `5`, `10`, `20`; default `5`                                                                                            | Jumlah baris per halaman.                                                                                                                      |
| `sort`     | `asc` atau `desc`; kompatibilitas lama                                                                                  | Dibaca sebagai sorting `total` jika `sortBy` yang valid tidak diberikan.                                                                       |

Catatan perilaku:

- Jika pasangan `from`/`to` tidak lengkap atau tidak valid, filter periode tidak diterapkan; URL tersebut tidak menghasilkan error API.
- Perubahan filter, periode, ukuran halaman, atau sorting melalui kontrol aplikasi mengembalikan pagination ke awal.
- `owner` dan `research` tetap menjadi dua pilihan sorting meskipun ditampilkan dalam satu kolom Pengaju/riset.
- Sorting `status` dan `submissionStatus` menggunakan label Indonesia; `invoice` menggunakan nama file atau tautan, sedangkan `invoiceNumber` menggunakan nomor invoice sebagai teks dengan urutan natural.
- Nilai uang diurutkan menggunakan Decimal, jumlah secara numerik, dan tanggal secara kronologis; nilai yang sama mempunyai urutan ID yang stabil.
- Ekspor Excel menggunakan seluruh hasil filter dan urutan aktif, melintasi pagination.
- Belum ada query parameter khusus untuk memfilter `submissionStatus` atau nomor invoice.

Preset kalender: Semua tanggal, Hari ini, Kemarin, Minggu ini, 7 hari terakhir, 28 hari terakhir, Bulan ini, Bulan lalu, dan Tahun ini. Preset berperiode diterjemahkan menjadi `from`/`to`; Semua tanggal menghapus keduanya. Minggu dimulai Senin.

### 4.2 Dashboard: `/dashboard`

| Parameter                   | Peran       | Nilai/default                                                                    | Efek                                                                                                                                                                |
| --------------------------- | ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trendFrom`                 | Admin       | `YYYY-MM-DD`                                                                     | Awal periode grafik Tren nilai Pembelian Barang.                                                                                                                    |
| `trendTo`                   | Admin       | `YYYY-MM-DD`                                                                     | Akhir periode grafik; pasangan harus valid dan inklusif WIB. Tanpa periode valid, default delapan minggu yang mencakup minggu berjalan.                             |
| `trend`                     | Admin       | `all`                                                                            | Menggunakan rentang data pengajuan yang tersedia sampai hari ini; jika ada bersama periode khusus, `trend=all` diprioritaskan.                                      |
| `urgencyResearch`           | Admin       | ID riset; default semua                                                          | Memfilter Peta urgensi request; terpisah dari periode tren. ID tidak dikenal kembali ke semua riset.                                                                |
| `followupStatus`            | Pengaju     | `pending_review`, `approved`, `ordered`, `in_transit`; default semua tahap aktif | Memfilter grafik tindak lanjut milik akun aktif.                                                                                                                    |
| `personalWeeks`             | Pengaju     | `4`, `8`, `12`; default `8`                                                      | Jumlah minggu terakhir pada Tren pengajuan dan penerimaan. Mengubahnya melalui kontrol menghapus pilihan minggu.                                                    |
| `personalWeek`              | Pengaju     | `YYYY-MM-DD`, tanggal Senin salah satu bucket yang ditampilkan                   | Membuka daftar pengajuan/penerimaan minggu terpilih. Nilai di luar bucket tidak memilih agenda.                                                                     |
| `sortBy`, `sortDir`, `sort` | Kedua peran | Aturan sorting sama dengan tabel request                                         | Mengurutkan **lima request terbaru** yang sudah dipilih berdasarkan tanggal pengajuan, bukan mencari lima teratas dari seluruh data berdasarkan kolom sorting lain. |

Tabel terbaru dashboard tidak menggunakan `q`, `status`, `research`, `from`, `to`, `page`, atau `size` untuk menyaring/membagi lima baris tersebut. Filter grafik juga tidak menyaring tabel terbaru. Grafik masing-masing peran menggunakan data dalam cakupannya dan tidak mempunyai endpoint analitik server.

Agregasi tren Admin: harian sampai 31 hari, mingguan sampai 180 hari, dan bulanan untuk periode lebih panjang. Preset tambahan `8 minggu terakhir` hanya berlaku pada kontrol periode tren. Penerimaan pada grafik Pengaju menggunakan transisi Diterima yang tercatat, bukan status pengajuan administratif `submitted`.

### 4.3 Pengguna dan riset

| Halaman           | Parameter | Nilai/default                                                  | Efek                                                      |
| ----------------- | --------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| `/users`          | `q`       | Teks; default kosong                                           | Mencari nama, NIP/NIM, email, atau nama riset perwakilan. |
| `/users`          | `sortBy`  | `name`, `identifier`, `email`, `role`, `research`, `createdAt` | Default nama A–Z.                                         |
| `/users`          | `sortDir` | `asc` atau `desc`                                              | Dengan key valid, selain `desc` dibaca sebagai `asc`.     |
| `/users`          | `page`    | Bilangan bulat mulai `1`                                       | Halaman daftar; dibatasi ke rentang yang tersedia.        |
| `/users`          | `size`    | `5`, `10`, `20`; default `5`                                   | Ukuran halaman.                                           |
| `/research-types` | `q`       | Teks; default kosong                                           | Mencari nama atau deskripsi riset.                        |

NIP/NIM dipertahankan sebagai teks, termasuk nol awal, dengan sorting natural. Parameter sorting/pagination daftar pengguna tidak berlaku pada halaman profil atau detail pengguna.

### 4.4 Katalog RAB: `/requests/rab`

| Parameter     | Nilai/default                         | Efek                                                                                                |
| ------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `rabq`        | Teks; default kosong                  | Mencari nama dokumen, riset, atau nama barang dalam RAB.                                            |
| `rabResearch` | ID riset; default semua dalam cakupan | Memfilter RAB menurut riset. Tetap tunduk pada cakupan akun.                                        |
| `versions`    | `active` atau `all`; default aktif    | `all` menampilkan seluruh versi hanya bagi Admin. Pengaju tetap melihat versi aktif yang diizinkan. |

Katalog RAB tidak mempunyai pagination atau sorting yang dapat dipilih lewat URL saat ini; urutan tetap tanggal pembuatan terbaru.

### 4.5 Barang dalam RAB: `/requests/rab/:rabId`

| Parameter  | Nilai/default                                                             | Efek                                                                                     |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `itemq`    | Teks; default kosong                                                      | Mencari nama barang atau keterangan dalam dokumen terpilih.                              |
| `itemSort` | `name`, `quantity`, `unit`, `unitPrice`, `total`, `notes`; default `name` | Kolom sorting barang. Key lain mengikuti perbandingan nama.                              |
| `itemDir`  | `asc` atau `desc`; default `asc`                                          | Arah sorting.                                                                            |
| `itemPage` | Nomor halaman mulai `1`; default `1`                                      | Halaman tabel barang, dibatasi ke rentang yang tersedia. Gunakan bilangan bulat positif. |
| `itemSize` | `5`, `10`, `20`; default `5`                                              | Ukuran halaman tabel barang.                                                             |

Pencarian, perubahan sorting, atau ukuran halaman melalui kontrol aplikasi mengembalikan `itemPage` ke awal. Pemilihan worksheet, pemetaan kolom, draft barang, dan pagination review impor berada dalam state form pada `/requests/rab/import`, bukan query parameter pada tabel ini.

### 4.6 Form pengajuan dan navigasi kembali

| Parameter    | Halaman/konteks                                    | Efek                                                                                                                                                      |
| ------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source=rab` | `/requests/new`                                    | Membuka form dalam mode Dari RAB; pengguna masih harus memilih dokumen aktif dan barang yang valid.                                                       |
| `sourceRab`  | `/requests/new`                                    | ID dokumen RAB sumber. Keberadaan parameter ini juga memilih mode RAB. Dokumen harus dapat digunakan akun aktif.                                          |
| `sourceItem` | `/requests/new`                                    | ID barang dalam dokumen `sourceRab`; mengisi data awal bila pasangan ditemukan. Tanpa pasangan valid, form tetap memerlukan pemilihan yang benar.         |
| `returnTo`   | Halaman form/detail melalui helper navigasi record | Path internal tujuan kembali, termasuk filter/pagination. Nilai path dan query tujuan harus di-URL-encode ketika dimasukkan sebagai satu query parameter. |

Contoh sumber bawaan:

```text
/requests/new?sourceRab=demo-rab-smart&sourceItem=demo-rab-smart-item-1
/requests/new?source=rab
/requests/request-1?returnTo=%2Frequests%3Fstatus%3Dpending_review%26page%3D2
```

`returnTo` hanya menerima prefix internal `/dashboard`, `/requests`, `/users`, `/research-types`, `/profile`, atau `/notifications` dengan batas path/query yang sesuai. Nilai eksternal atau tidak sesuai kembali ke fallback halaman. Parameter ini tidak melewati penjagaan peran. Halaman profil mempunyai tombol kembali tetap ke dashboard.

Form dan detail request default kembali ke `/requests`; pengguna ke `/users`; riset ke `/research-types`; RAB ke `/requests/rab`; notifikasi ke dashboard. Penyimpanan request/pengguna/riset membuka detail terkait sambil mempertahankan konteks tujuan kembali. Penyimpanan invoice memperbarui tampilan pada halaman invoice yang sama.

## 5. Nilai status dan ID contoh

### 5.1 Tahapan pembelian: `request.status`

Kode berikut dipakai oleh query `status`, sorting status pembelian, dan aturan transisi:

| Kode             | Label                | Tahap berikutnya yang diizinkan                                                           |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `pending_review` | Menunggu Persetujuan | Admin: `approved` atau `rejected`; Pengaju pemilik dapat membatalkan menjadi `cancelled`. |
| `approved`       | Disetujui            | `ordered`                                                                                 |
| `ordered`        | Sudah Dipesan        | `in_transit`                                                                              |
| `in_transit`     | Dalam Pengiriman     | `delivered`                                                                               |
| `delivered`      | Diterima             | `completed`, setelah syarat invoice terpenuhi.                                            |
| `completed`      | Selesai              | Terminal.                                                                                 |
| `rejected`       | Ditolak              | Terminal.                                                                                 |
| `cancelled`      | Dibatalkan           | Terminal.                                                                                 |

Persetujuan memeriksa alokasi terhadap komitmen. Penolakan membutuhkan alasan. Pengaju tidak dapat menjalankan transisi Admin melalui URL maupun fungsi mutasi.

### 5.2 Status pengajuan administratif: `request.submissionStatus`

| Kode            | Label          | Aturan                                              |
| --------------- | -------------- | --------------------------------------------------- |
| `not_submitted` | Belum diajukan | Default request baru dan data lama tanpa field ini. |
| `submitted`     | Sudah diajukan | Dapat dipilih langsung oleh Admin.                  |

Kedua nilai dapat ditukar oleh Admin melalui badge pada tabel/detail, tanpa halaman editor baru. Pengaju hanya membaca. Perubahan tidak memajukan tahapan pembelian, mengubah nilai request, atau mengubah komitmen dana. `submitted` juga berbeda dari tanggal pembuatan/pengajuan request yang digunakan grafik dan filter tanggal.

### 5.3 Parameter ID

| Parameter              | Contoh data bawaan                                             | Keterangan                                           |
| ---------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `:requestId`           | `request-1`                                                    | ID record pembelian.                                 |
| `:userId`              | `demo-admin`, `demo-pengaju`                                   | ID profil pengguna; rute manajemen tetap Admin saja. |
| `:researchId`          | `smart`, `automation`, `malware`, `weather`, `lake`, `farming` | ID riset; dipakai juga sebagai nilai filter riset.   |
| `:rabId` / `sourceRab` | `demo-rab-smart`                                               | ID versi RAB. Impor baru menghasilkan ID berbeda.    |
| `sourceItem`           | `demo-rab-smart-item-1`                                        | ID barang di dalam versi RAB tertentu.               |

Contoh hanya berlaku selama data terkait masih ada dan diizinkan. URL untuk ID terhapus/tidak tersedia tidak membuat data baru secara otomatis.

## 6. Kompatibilitas URL lama

Pengalihan kompatibilitas hanya diproses ketika pathname tepat `/requests` atau `/dashboard`. Pengalihan menggunakan navigasi client `replace`, bukan respons HTTP `301`/`302` dari server.

| Parameter lama | Nilai yang dibaca                                   | Peran dalam pengalihan                                                                                    |
| -------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `create`       | Kehadiran parameter, termasuk nilai kosong atau `0` | Membuka pembuatan request.                                                                                |
| `detail`       | ID request                                          | Membuka detail request.                                                                                   |
| `tab`          | `rab`                                               | Memilih katalog RAB sebagai konteks tujuan.                                                               |
| `rab`          | ID dokumen RAB                                      | Memilih detail dokumen ketika pengalihan RAB dipicu; parameter ini sendiri tidak cukup memicu pengalihan. |

Pada form baru, parameter `source` bernilai `rab` memilih mode pengajuan dari RAB; ini terpisah dari penanda kompatibilitas di atas.

| Bentuk URL lama                                                                | Tujuan baru                              | Konteks yang dipertahankan                                |
| ------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------- |
| `/requests?create=1`                                                           | `/requests/new`                          | Tujuan kembali ke daftar dimasukkan sebagai `returnTo`.   |
| `/dashboard?create=1`                                                          | `/requests/new`                          | Tujuan kembali ke dashboard.                              |
| `/requests?detail=request-1`                                                   | `/requests/request-1`                    | Filter/query daftar lain masuk ke `returnTo`.             |
| `/dashboard?detail=request-1`                                                  | `/requests/request-1`                    | Konteks dashboard masuk ke `returnTo`.                    |
| `/requests?tab=rab`                                                            | `/requests/rab`                          | Query katalog yang tersisa tetap diteruskan.              |
| `/dashboard?tab=rab`                                                           | `/requests/rab`                          | Membuka katalog RAB.                                      |
| `/requests?tab=rab&rab=demo-rab-smart`                                         | `/requests/rab/demo-rab-smart`           | Tujuan kembali ke katalog RAB beserta query yang tersisa. |
| `/requests?create=1&sourceRab=demo-rab-smart&sourceItem=demo-rab-smart-item-1` | `/requests/new?sourceRab=…&sourceItem=…` | Pasangan sumber RAB dan konteks kembali tetap diteruskan. |

Tabel menampilkan path tujuan utama; URL hasil dapat mempunyai query `returnTo` yang sudah di-encode. Keberadaan `create`, bukan hanya nilai `1`, memicu alur pembuatan; `?create=0` juga diperlakukan sebagai pembuatan. Bila beberapa penanda ada sekaligus, prioritas tujuan adalah `create`, lalu `detail`, lalu dokumen/katalog RAB. `?rab=…` tanpa penanda `tab=rab`, `detail`, atau `create` tidak memicu pengalihan sendiri.

URL baru tetap tunduk pada aturan sesi/peran. Parameter lama tidak memberi akses Admin kepada Pengaju.

## 7. Endpoint HTTP yang didefinisikan

### 7.1 `GET /api/v1/setup` — mock pengembangan/pengujian

| Properti                                 | Detail                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Method                                   | `GET`                                                                          |
| Pola handler                             | `*/api/v1/setup`                                                               |
| Contoh URL browser lokal                 | `http://127.0.0.1:5173/api/v1/setup`, ketika worker mock aktif di development. |
| Contoh URL dalam unit test               | `http://localhost/api/v1/setup`, diintersep MSW Node pada test.                |
| Implementasi                             | Handler MSW pada `apps/web/src/mocks/handlers.ts`.                             |
| Request body                             | Tidak diperlukan.                                                              |
| Parameter wajib                          | Tidak ada.                                                                     |
| Autentikasi handler                      | Tidak ada pemeriksaan akun/header otorisasi pada handler mock ini.             |
| Respons ketika ditangani mock            | HTTP `200`, JSON sebagaimana contoh di bawah.                                  |
| Pemanggilan oleh halaman bisnis saat ini | Tidak ditemukan; handler diuji secara eksplisit dalam unit test.               |
| Tujuan                                   | Menyatakan bahwa data berasal dari mock dan backend belum tersambung.          |

```json
{
  "data": {
    "mode": "mock",
    "backendConnected": false
  }
}
```

Worker browser hanya dimulai jika `import.meta.env.DEV` bernilai benar dan `VITE_ENABLE_MOCKS=true`. Mengaktifkan flag pada production preview tidak melewati syarat development. Unit test mempunyai MSW server interceptor tersendiri; ini bukan server backend yang berjalan untuk aplikasi.

Handler menggunakan path `/api/v1/setup` secara eksplisit. Mengganti `VITE_API_BASE_URL` tidak otomatis mengganti pola handler tersebut. Jika mock tidak aktif, source proyek tidak menyediakan kontrak respons JSON untuk URL ini; respons server frontend/fallback HTML tidak boleh dianggap sebagai respons API setup.

### 7.2 Provider REST yang dikonfigurasi

`AppProviders` menginisialisasi `simpleRestProvider(clientEnvironment.apiBaseUrl)` dan memasangnya pada Refine. Prefix default adalah `/api/v1`. Konfigurasi menerima path relatif, HTTPS, atau HTTP untuk `localhost`/`127.0.0.1`.

Namun, halaman bisnis menggunakan store demo, bukan hook CRUD data provider. Tidak ada resource backend yang didaftarkan pada provider di source tersebut. Karena itu, prefix `/api/v1` tidak berarti endpoint request, pengguna, riset, autentikasi, unggahan, ekspor, atau analitik sudah diimplementasikan.

Tidak ada kontrak API bisnis server berupa method, payload HTTP, kode respons, pagination server, cookie/token server, atau envelope error produksi yang dapat didokumentasikan sebagai endpoint aktif dari kode saat ini. Fungsi lokal pada bagian berikut menjelaskan implementasi yang benar-benar dipanggil aplikasi.

## 8. Pemetaan aksi bisnis ke operasi lokal

Tabel ini merupakan referensi fungsi internal, **bukan daftar endpoint HTTP tambahan**. Input berupa objek TypeScript atau `File` browser, bukan request body server.

| Aksi/konteks halaman                        | Operasi yang digunakan                                                                               | Akses dan dampak                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Masuk pada `/`                              | `demoAuthProvider.login` → `loginDemo(email, password)`                                              | Email di-trim dan diubah menjadi huruf kecil; password dicocokkan persis. Memilih salah satu akun demo, tanpa permintaan autentikasi server.           |
| Pemeriksaan identitas/peran                 | `demoAuthProvider.check`, `getIdentity`, `getPermissions`; `currentUser()`                           | Membaca akun aktif dari snapshot lokal.                                                                                                                |
| Keluar dari shell/profil                    | `useDemoLogout()` → `demoAuthProvider.logout` → `logoutDemo()`                                       | Membersihkan sesi/cache pengguna dan mengarahkan ke login, tanpa URL `/logout` tersendiri.                                                             |
| Membaca daftar/detail request               | `scopedRequests(data, user)`, `visibleRequest(id)`                                                   | Admin semua data belum dihapus; Pengaju hanya miliknya.                                                                                                |
| Membuat request pada `/requests/new`        | `saveRequest(input, undefined, source?)`                                                             | Pengaju; riset harus cocok dengan profil. Sumber RAB memeriksa versi aktif, riset, barang, nama, dan satuan.                                           |
| Mengedit pada `/requests/:requestId/edit`   | `saveRequest(input, id)`                                                                             | Admin; mempertahankan data yang tidak diubah dan memeriksa validasi yang berlaku.                                                                      |
| Mengubah status pengajuan pada tabel/detail | `changeSubmissionStatus({ id, expectedStatus, expectedRevision?, nextStatus })`                      | Admin; memeriksa nilai awal sebelum menyimpan dan menolak kegagalan persistensi tanpa mengubah data di memori.                                         |
| Mengubah tahap pembelian                    | `changeRequestStatus({ id, expectedStatus, expectedRevision?, nextStatus, reason? })`                | Admin; asynchronous untuk pemeriksaan invoice/file bila menyelesaikan pembelian. Memeriksa status awal, transisi, anggaran, serta kelengkapan invoice. |
| Menghapus request dari daftar               | `deleteRequest(id)`                                                                                  | Admin; dialog konfirmasi lalu menandai record `deleted`, tanpa rute/endpoint hapus tersendiri.                                                         |
| Membatalkan request dari daftar             | `cancelRequest(id)`                                                                                  | Pengaju pemilik, hanya `pending_review`; konfirmasi, riwayat status, dan notifikasi terkait.                                                           |
| Menyimpan invoice                           | `saveInvoice({ requestId, number, amount, invoiceDate, file?, url, expectedUpdatedAt })`             | Admin; nomor asli, nominal positif, tanggal maksimal hari ini WIB, serta file/tautan valid. Memeriksa versi invoice sebelum menyimpan penggantian.     |
| Membaca file invoice                        | `loadInvoiceFile(requestId)`                                                                         | Mengikuti cakupan request; membaca Blob dari IndexedDB dan memeriksa akses kembali setelah operasi asynchronous.                                       |
| Membaca ringkasan/grafik                    | `dashboardSummary`, `trendAnalytics`, `urgencyAnalytics`, `personalFollowup`, `personalReceiptTrend` | Perhitungan lokal dari snapshot; data Pengaju dibatasi pada pemilik akun.                                                                              |
| Membaca katalog/detail RAB                  | `scopedRabs(data, user)`, `visibleRab(id)`                                                           | Sesuai cakupan versi aktif/riset atau referensi request historis yang diizinkan.                                                                       |
| Mengimpor RAB                               | `importRab({ researchId, name, file, items })`                                                       | Admin; menyimpan dokumen dan versi baru, mengarsipkan versi sebelumnya, maksimal 1.000 barang.                                                         |
| Membaca sumber RAB                          | `loadRabFile(documentId)`                                                                            | Memeriksa akses; sumber demo menghasilkan Blob CSV, sumber unggahan dibaca dari IndexedDB.                                                             |
| Menambah/mengedit pengguna                  | `saveUser(input, id?)`                                                                               | Admin; email/NIP/NIM unik, riset valid, dan perlindungan akun demo utama.                                                                              |
| Menghapus pengguna                          | `deleteUser(id)`                                                                                     | Admin; menolak akun demo utama dan pengguna yang masih dirujuk request.                                                                                |
| Menambah/mengedit riset                     | `saveResearch(input, id?)`                                                                           | Admin; nama unik dan alokasi tidak lebih kecil daripada komitmen yang berlaku.                                                                         |
| Menghapus riset                             | `deleteResearch(id)`                                                                                 | Admin; menolak referensi request, pengguna, atau RAB yang masih ada.                                                                                   |
| Menandai notifikasi dibaca                  | `markNotificationsRead(ids?)`                                                                        | Hanya notifikasi akun aktif. Tanpa `ids`, menandai semua notifikasinya.                                                                                |
| Menandai pemeriksaan popup dashboard        | `consumeAdminNotice()`                                                                               | Admin; mengatur `adminNoticeSeen`, tidak menandai semua notifikasi dibaca.                                                                             |
| Mengekspor dari `/requests`                 | `downloadRequests(rows, data, context)` → `buildRequestWorkbook(...)`                                | Admin; membuat XLSX di browser dengan seluruh hasil filter/urutan, termasuk status pengajuan dan nomor invoice.                                        |
| Mengunduh template RAB                      | Helper `template('csv' \| 'xlsx')` pada katalog                                                      | Kontrol tersedia untuk Admin; berkas dihasilkan di browser.                                                                                            |

Field utama form request: `item`, `unit`, `researchId`, `quantity`, `unitPrice`, `requiredDate`, `url`, dan `notes`. Jumlah merupakan bilangan bulat positif, harga positif, dan tanggal kebutuhan baru minimal tiga hari kerja berikutnya sampai maksimal 180 hari dalam WIB. Referensi RAB disimpan terpisah pada request; nomor invoice bukan bagian input request ini.

Invoice baru/pembaruan mewajibkan nomor dokumen sebagai teks maksimal 120 karakter, nominal positif, tanggal dokumen, serta file atau tautan. Nol awal nomor dipertahankan. Data lama mendapat nomor kosong (`null`) dan ditampilkan sebagai Belum dilengkapi, tanpa mengubah status Selesai lama otomatis.

### Penyimpanan yang mendukung operasi lokal

| Lokasi         | Nama/key                                                | Isi                                                                                                                                  |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| SessionStorage | `stas-rg-demo-v1`                                       | Snapshot tervalidasi Zod: sesi, pengguna, riset, request, riwayat, invoice metadata, pengiriman, notifikasi, RAB, dan penanda popup. |
| SessionStorage | `stas-rg-files-session-v1`                              | Namespace dokumen tab aktif.                                                                                                         |
| SessionStorage | `stas-scroll:<pathname><search>`                        | Posisi scroll daftar untuk navigasi kembali.                                                                                         |
| IndexedDB      | Database `stas-rg-attachments-v1`, object store `files` | Blob dokumen unggahan dengan namespace tab.                                                                                          |

Nama database/key tersebut bukan URL API. Refresh dan pergantian akun pada tab yang sama mempertahankan data yang masih tersedia. Penghapusan data browser dapat menghapus dokumen. Tidak ada sinkronisasi ke server/perangkat lain.

## 9. Dokumen, unduhan, dan aset

| Jenis                                     | Bentuk URL/akses                                                             | Keterangan                                                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File invoice dan RAB                      | Blob lokal, lalu object URL `blob:…` untuk buka/unduh/pratinjau              | Dibuat saat diperlukan dan dicabut setelah tidak dipakai. Bukan tautan unduh permanen atau endpoint dokumen server.                                                                          |
| Tautan invoice eksternal                  | HTTP/HTTPS yang diisi Admin                                                  | Alamat milik penyedia/pemasok, bukan endpoint tetap STAS-RG. Pengaju pemilik dapat melihat tautan yang tersedia.                                                                             |
| Tautan barang                             | HTTP/HTTPS pada request                                                      | Dibuka sebagai tautan eksternal; validasinya tidak membentuk integrasi API pemasok.                                                                                                          |
| Ekspor Excel                              | Object URL Blob; nama `pembelian-barang-YYYY-MM-DD.xlsx`                     | Workbook dibuat lokal. Tidak ada URL ekspor server tetap. Berisi periode, filter, data invoice, status pengajuan, dan nomor invoice; tidak mengekspor tautan `blob:` sebagai tautan invoice. |
| Template RAB                              | Object URL Blob; `template-rab.csv` atau `template-rab.xlsx`                 | Dibuat lokal oleh kontrol pada katalog RAB.                                                                                                                                                  |
| JavaScript, CSS, font lokal, logo/favicon | Path aset yang dikelola Vite; build menggunakan nama ber-hash di `/assets/…` | Nama hasil build dapat berubah; bukan endpoint API bisnis.                                                                                                                                   |
| Worker PDF dan parser RAB                 | URL modul/worker yang dikelola Vite                                          | Mengolah dokumen di browser; bukan layanan parsing/OCR server.                                                                                                                               |
| `/mockServiceWorker.js`                   | Berkas worker statis pengembangan                                            | Mendukung MSW ketika diaktifkan; bukan REST API.                                                                                                                                             |

Invoice menerima PDF, XLSX, DOCX, PNG, JPEG, atau WebP; RAB menerima CSV, XLSX, atau PDF. Batas unggahan adalah `10 × 1024 × 1024` byte per berkas dan berkas tidak boleh kosong. RAB PDF dipratinjau dengan daftar barang yang diisi/dikoreksi manual, tanpa ekstraksi otomatis atau OCR.

## 10. Contoh alur URL

### 10.1 Admin meninjau request menunggu persetujuan

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/dashboard
http://127.0.0.1:5173/requests?status=pending_review
http://127.0.0.1:5173/requests/request-1
http://127.0.0.1:5173/requests/request-1/status
```

Pada daftar atau detail, Admin dapat mengganti Status pengajuan langsung tanpa URL baru. Perubahan tahap pembelian tetap menggunakan halaman `/status`.

### 10.2 Filter dan ekspor periode tertentu

```text
http://127.0.0.1:5173/requests?research=smart&from=2026-10-01&to=2026-10-31&sortBy=total&sortDir=desc&page=1&size=10
```

Menekan Ekspor Excel menghasilkan berkas dari seluruh hasil filter tersebut, bukan hanya sepuluh baris halaman aktif.

### 10.3 Pengaju membuat pembelian dari RAB

```text
http://127.0.0.1:5173/requests/rab
http://127.0.0.1:5173/requests/rab/demo-rab-smart
http://127.0.0.1:5173/requests/new?sourceRab=demo-rab-smart&sourceItem=demo-rab-smart-item-1
```

Pasangan sumber hanya dapat digunakan jika dokumen/barang masih aktif dan sesuai riset akun. Alternatif `/requests/new?source=rab` membuka mode RAB untuk memilih dokumen dan barang melalui dropdown. Pengajuan manual memakai `/requests/new`.

### 10.4 Invoice dan penawaran pengganti

```text
http://127.0.0.1:5173/requests/request-2/invoice
http://127.0.0.1:5173/requests/request-2/replacement
```

Pada data awal, `request-2` sudah berada pada tahap yang menerima kelengkapan invoice dan penawaran pengganti. Setelah data demo berubah, ketersediaan editor mengikuti tahap terbaru. URL delivery lama hanya mengarah ke detail barang. Pengaju hanya dapat membuka invoice jika request tersebut miliknya.

### 10.5 Analitik dengan state URL

```text
http://127.0.0.1:5173/dashboard?trendFrom=2026-10-01&trendTo=2026-10-27&urgencyResearch=smart
http://127.0.0.1:5173/dashboard?trend=all
http://127.0.0.1:5173/dashboard?followupStatus=pending_review&personalWeeks=8&personalWeek=2026-10-26
```

Dua contoh pertama digunakan Admin; contoh terakhir digunakan Pengaju. Pilihan minggu terakhir hanya berlaku jika tanggal tersebut termasuk bucket grafik yang tersedia saat halaman dibuka.

## 11. Sumber kode dan batas dokumentasi

| Area                           | Sumber utama di repository                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Seluruh rute halaman           | `apps/web/src/App.tsx`, `apps/web/src/router.tsx`                                                           |
| Sesi dan akses                 | `apps/web/src/features/auth/session-routes.tsx`, `demo-auth-provider.ts`, `use-demo-logout.ts`              |
| Form/detail dan guard tambahan | `apps/web/src/features/dashboard/resource-pages.tsx`, `editors.tsx`, `invoice.tsx`                          |
| URL lama dan navigasi kembali  | `apps/web/src/features/dashboard/legacy-navigation.ts`, `record-navigation.tsx`                             |
| Daftar, filter, dan sorting    | `apps/web/src/features/dashboard/request-list.tsx`, `pages.tsx`, `table-sorting.ts`, `date-range.ts`        |
| Grafik dan state URL           | `apps/web/src/features/dashboard/admin-analytics.tsx`, `personal-analytics.tsx`, `analytics.ts`             |
| RAB dan file                   | `apps/web/src/features/dashboard/rab-list.tsx`, `rab-import.tsx`, `file-preview.tsx`                        |
| Data dan operasi bisnis lokal  | `apps/web/src/features/demo/store.ts`, `model.ts`, `request-workflow.ts`, `attachment-db.ts`, `demo-rab.ts` |
| Ekspor                         | `apps/web/src/features/dashboard/export-requests.ts`                                                        |
| Konfigurasi API/Refine         | `apps/web/src/lib/environment.ts`, `apps/web/src/providers.tsx`, `apps/web/.env.example`                    |
| Mock HTTP                      | `apps/web/src/mocks/handlers.ts`, `browser.ts`, `handlers.test.ts`; aktivasi pada `apps/web/src/main.tsx`   |
| Port frontend                  | `apps/web/package.json`, `apps/web/playwright.config.ts`                                                    |

Inventaris ini tidak mendefinisikan endpoint backend baru dan tidak menganggap fungsi lokal sebagai API HTTP. Kontrak backend, integrasi kurir, pembayaran, penyimpanan dokumen server, dan autentikasi produksi belum tersedia dalam implementasi yang dipetakan. Saat backend ditambahkan, dokumentasikan method, path, request/response, autentikasi, kode error, dan aturan aksesnya sebagai kontrak API terpisah.

## Pembaruan alur penawaran pengganti � 28 Oktober 2026

Rute tambahan: `/requests/:requestId/replacement`. Admin mengirim link/harga pengganti pada tahap approved atau ordered; Pengaju pemilik membaca perbandingan dan memberi tanggapan. Route tetap memeriksa sesi dan cakupan request. Query returnTo mempertahankan konteks kembali. URL delivery lama hanya menjadi pengalihan; formulir dan fungsi saveFulfillment tidak lagi disediakan. Metadata fulfillment lama dipertahankan untuk kompatibilitas snapshot.

Operasi lokal baru: `proposeReplacement(id, expectedRevision, input)` dan `respondReplacement(id, expectedRevision, proposalId, decision, response)`. Input usulan berisi url, unitPrice dan reason. Decision accepted menerapkan tautan/harga setelah validasi alokasi; rejected membutuhkan alasan dan menahan pembelian sampai alternatif disetujui. Riwayat ReplacementProposal dan revision tersimpan pada request; tidak ada endpoint HTTP baru. Mutasi request memperbarui revisinya. Semua rute, filter dan aksi bisnis tetap memakai simulasi browser.

Invoice mendukung PDF, XLSX, DOCX, PNG, JPEG dan WebP, hingga 10 MB per file. Admin mengunggah dan Pengaju pemilik mengunduh melalui halaman invoice yang sama. Pratinjau Office dilakukan menggunakan aplikasi dokumen setelah unduhan, bukan endpoint konversi server.
