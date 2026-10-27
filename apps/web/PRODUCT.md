# STAS-RG Pembelian Barang

<!-- impeccable:product-schema 1 -->

## Platform

Web, berbahasa Indonesia. Desktop untuk pekerjaan Pembelian Barang dan mobile untuk memantau serta mengajukan kebutuhan.

## Users and jobs

Admin meninjau permintaan, mengelola proses pembelian, pengguna, riset, dan ekspor. Pengaju mengajukan kebutuhan dan memantau request miliknya.

## Workflows

Login demo sesuai peran. Request melalui persetujuan, pemesanan, pengiriman, penerimaan, dan penyelesaian. Penolakan membutuhkan alasan. Pengaju dapat membatalkan request sendiri yang menunggu persetujuan.

## Constraints

React, Vite, TypeScript, CSS Modules, Refine, React Hook Form/Zod, Decimal.js, Heroicons, Sonner dan ExcelJS. Identitas logo asli dan font lokal Plus Jakarta Sans dipertahankan. Data serta sesi merupakan simulasi frontend per tab, bukan pengamanan produksi; password tidak disimpan.

## Confirmed decisions

Popup Admin sekali setiap sesi login, tanpa pengulangan ketika navigasi atau refresh. Halaman tanpa request pending tidak menampilkan popup. Sorting berada pada header kolom. Ekspor Admin tersedia di Pembelian Barang. Terminologi: Perwakilan riset.

## Success

Tugas mudah ditemukan, informasi cepat dipindai, aksi mendapatkan umpan balik, keyboard dan layar kecil dapat digunakan. Target aksesibilitas WCAG AA. Alokasi dan perubahan status harus konsisten serta dapat ditelusuri.

## Documents and insights

Invoice dikelola Admin sejak persetujuan, dapat dilihat Pengaju pemilik request dan wajib sebelum Selesai. Format PDF/gambar hingga 10 MB atau tautan HTTP/HTTPS. Blob memakai IndexedDB per tab, metadata memakai snapshot Zod; file baru harus berhasil disimpan sebelum penggantian metadata. Pemeriksaan status setelah operasi async mencegah perubahan stale.

Tab Pembelian Barang dan RAB menggunakan URL. RAB CSV/XLSX/PDF maksimal 10 MB dan 1.000 barang; worksheet/pemetaan, review dan koreksi mendahului konfirmasi. PDF dipratinjau dan diisi manual tanpa OCR. Versi RAB bersifat tetap untuk request lama, satu versi aktif per riset. Pengaju membaca daftar barang dan membuat request dari barang yang dipilih. Nilai RAB tidak mengubah alokasi.

Analitik Admin menggunakan tren nilai dengan rentang tanggal WIB dan peta urgensi berdasarkan sisa hari serta nilai request aktif. Grafik Pengaju menampilkan kebutuhan mingguan miliknya dengan pilihan agenda. Periode tren terpisah dari filter tabel dan ekspor; seluruh grafik mempunyai alternatif tabel, tooltip, dan keadaan kosong.

## Routed workflows

Tambah, edit, dan detail menggunakan halaman di dalam shell. Request mempunyai subhalaman status, invoice, dan pengiriman. Pengguna dan riset mempunyai detail serta editor; profil, notifikasi, impor RAB, dan detail RAB memiliki rute sendiri. URL lama dialihkan dengan konteks filter dan sumber RAB. Dialog dipakai untuk konfirmasi, popup sesi Admin, dan navigasi mobile. Perubahan belum disimpan dilindungi oleh useBlocker dan beforeunload.

Invoice menyimpan nominal asli serta tanggal dokumen yang tidak melewati hari ini. Nilai request, total invoice, dan selisih ditampilkan terpisah; pencatatan invoice tidak mengubah alokasi atau komitmen. Metadata invoice lama tetap kosong sampai dilengkapi. Penyelesaian baru membutuhkan metadata lengkap dan dokumen valid; status Selesai lama dipertahankan.

Admin mengisi pemasok, kurir, resi, estimasi tiba, dan catatan secara manual sejak Disetujui sampai Selesai. Pengaju hanya melihat informasi request miliknya. Penyimpanan pengiriman tidak memajukan status. Linimasa menggunakan riwayat nyata; tanggal tahap yang tidak tercatat tidak direka. Perubahan pengiriman memiliki versi dan notifikasi.

## Local persistence

SessionStorage menyimpan metadata/sesi tanpa password. IndexedDB menyimpan dokumen dengan namespace tab; refresh dan pergantian akun tetap mempertahankan berkas. Sesi baru tidak menampilkan dokumen lama. Ini tidak menggantikan autentikasi server, audit produksi, backup atau penyimpanan dokumen terkelola.
