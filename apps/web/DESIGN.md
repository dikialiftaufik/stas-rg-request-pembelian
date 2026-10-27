---
name: STAS-RG Warm Green
description: Portal operasional Pembelian Barang riset dengan hierarki yang tenang dan ringkas.
colors:
  primary: '#176b43'
  primary-hover: '#115333'
  canvas: '#f3f5ef'
  surface: '#ffffff'
  sage: '#e8efe5'
  sidebar: '#f9faf6'
  ink: '#18392f'
  muted: '#5d6c63'
  border: '#d6dfd3'
  danger: '#b42318'
  export: '#176b43'
  chart-urgent: '#a65b17'
  chart-soon: '#718a59'
  chart-ordered: '#426b83'
typography:
  headline:
    fontFamily: 'Plus Jakarta Sans Variable, system-ui, sans-serif'
    fontSize: '1.75rem'
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: '-0.03em'
  body:
    fontFamily: 'Plus Jakarta Sans Variable, system-ui, sans-serif'
    fontSize: '0.875rem'
    lineHeight: 1.5
  label:
    fontFamily: 'Plus Jakarta Sans Variable, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
rounded:
  control: '8px'
  panel: '12px'
spacing:
  tight: '8px'
  group: '16px'
  section: '24px'
  page: '32px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    height: '38px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-export:
    backgroundColor: '{colors.export}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    height: '38px'
---

## Overview

Mode Operate: desain membantu pekerjaan Pembelian Barang. Identitas hijau hangat berasal dari logo dan konteks riset STAS-RG. Tampilkan informasi dan aksi sebelum dekorasi.

## Colors

Token normatif berada di src/styles/globals.css. Canvas hangat memisahkan panel data putih; sage digunakan untuk KPI dan seleksi. Warna status mempunyai label serta tidak menjadi satu-satunya petunjuk. Keluar menjadi merah saat hover dan fokus.

## Typography

Satu keluarga font lokal. Isi dan tabel 14 px; pendukung 12–13 px. Judul halaman 28 px, bagian 18–20 px. Angka tabular dan rata kanan untuk nilai; tanggal diurutkan berdasarkan data aslinya. Login menggunakan judul 32 px dan panel brand 48 px.

## Layout

Sidebar desktop 232 px, ciut 72 px, topbar 64 px. Padding 24–32 px; mobile 16 px. Konten maksimum 1600 px. KPI empat kolom, turun menjadi dua; riset tiga menjadi dua/satu kolom. Tabel scroll dalam areanya dengan kolom Aksi tetap terlihat. Login dua kolom mulai 1024 px; form maksimum 420 px.

## Elevation & Depth

Panel dan kartu memakai perbedaan warna atau garis tipis. Bayangan disediakan untuk menu dan dialog. Backdrop dialog menunjukkan lapisan modal; tidak ada animasi masuk halaman yang menunda pekerjaan.

## Shapes

Kontrol radius 8 px, panel 12 px, menu 10 px. Kontrol desktop 38 px, target ikon 32 px; pada pointer sentuh minimal 44 px. Input mobile 16 px untuk menjaga keterbacaan dan menghindari zoom otomatis browser.

## Components

Aksi primer hijau solid, sekunder putih berbingkai, destruktif merah pada konfirmasi. Header tabel memakai tombol sorting dan aria-sort. Menu mendukung panah/Home/End, Escape, klik luar, dan pengembalian fokus. Dialog konfirmasi mengelola fokus; form dan detail memakai halaman bertautan langsung. Toast 4 detik dapat ditutup dan berada di kanan atas desktop/bawah mobile. Pertahankan pesan error di dekat field.

### Documents, charts and filters

Select, menu, kalender dan dialog memakai komponen registry resmi @shadcn/Radix yang disesuaikan token, bukan native select. Portal dropdown mempertahankan fokus dalam kontrol; Escape pada dropdown menutup pilihan terlebih dahulu. Aksi destruktif dan penggantian invoice membutuhkan konfirmasi. File baru tidak mengganti file lama sebelum commit berhasil.

Kolom Pengaju/riset menyusun nama utama dan riset pendukung dalam satu sel; menu header menyediakan A–Z/Z–A untuk keduanya. Badge status menggunakan label tanpa titik dekoratif. Invoice mempunyai kolom tersendiri, Aksi tetap sticky. Ekspor dan impor memakai varian hijau yang sama, dibedakan oleh ikon serta label.

Status pengajuan memakai badge outline untuk Belum diajukan dan hijau untuk Sudah diajukan, dengan label yang tetap jelas tanpa warna. Bagi Admin, badge menjadi pemicu menu radio bertema dengan pilihan tercentang, dukungan keyboard, Escape, dan pengembalian fokus. Pengaju melihat badge baca saja. Kolom No. invoice mempertahankan format teks dan dapat membungkus nomor panjang; scroll horizontal tetap dibatasi pada tabel. Data invoice lama menampilkan Belum dilengkapi tanpa mengarang nomor dokumen.

Chart Admin menjawab tren nilai dan urgensi kebutuhan; chart Pengaju memisahkan tindak lanjut barang dari tren pemenuhan. Kontainer stabil, dengan tooltip, legenda, bentuk penanda urgensi dan alternatif tabel. Dua kolom kedua peran menjadi satu pada layar kecil.

Rentang tanggal berupa Popover dengan preset dan kalender, kontrol Dari/Sampai, Terapkan/Batal dan hapus rentang. Desktop menempatkan preset di samping; mobile menyusunnya di atas kalender dalam Sheet dari bawah, dengan tombol aksi tetap terjangkau. Perubahan hanya berlaku setelah Terapkan. Pengurutan, filter dan periode mengembalikan pagination ke awal tanpa toast.

RAB memakai katalog dokumen lalu tabel barang yang dapat dicari, diurutkan dan dipaginasi. Pratinjau sumber dipisahkan dari daftar barang untuk menjaga fokus. Impor memakai tiga tahap terlihat, error per baris dan total; PDF menggunakan canvas PDF.js, bukan iframe atau OCR. Tampilan dokumen menyediakan buka/unduh dan metadata untuk membantu pemulihan file yang hilang.

## Do's and Don'ts

Gunakan ikon Heroicons 16–18 px, nilai aktual, empty state yang menjelaskan langkah berikutnya, dan fokus yang terlihat pada kontrol. Jangan mengulang popup ketika navigasi, memberi toast pada sorting, memakai warna pelangi pada KPI, atau memperbesar kontrol untuk mengisi ruang kosong. Fokus programatik pada landmark main tidak diberi cincin dekoratif; kontrol interaktif tetap memiliki indikator fokus.

## Halaman kerja dan analitik

Form dan detail berada pada halaman: breadcrumb, tombol kembali, judul, kartu utama dan ringkasan kanan. Lebar maksimal 1.280 px; kolom 2:1 pada desktop dan satu kolom di bawah 1.024 px. Card, Field, Breadcrumb dan AlertDialog berasal dari registry resmi shadcn Radix, dengan token serta Heroicons proyek. Tombol ekspor dan impor menggunakan varian primary yang sama.

Tren nilai memakai label bulan Indonesia, rentang WIB dan agregasi adaptif: harian hingga 31 hari, mingguan hingga 180 hari, lalu bulanan. Periode tepi diberi keterangan. Peta urgensi memetakan sisa hari terhadap nominal; empat kelompok menggunakan bentuk dan warna, dengan jumlah per kelompok serta daftar prioritas untuk titik bertumpuk. Label Hari ini memakai ruang atas plot tersendiri agar tidak berimpit dengan nominal.

Pengaju memakai grafik batang horizontal usia pengajuan di kiri, maksimal delapan barang aktif terlama; nama lengkap dan seluruh hasil tersedia pada tabel. Grafik garis di kanan membandingkan request diajukan dan diterima, dengan garis solid dan putus-putus agar tidak bergantung pada warna. Sumbu jumlah memakai nol dan batas atas sesuai data. Periode memakai minggu Senin–Minggu WIB dan label bulan Indonesia; minggu berjalan ditandai belum lengkap. Klik titik atau tombol tabel memilih minggu; klik batang atau tautan tabel membuka detail barang. Titik memiliki nama aksesibel, fokus terlihat dan aktivasi Enter/Space. Kontainer grafik dan empty state mempunyai tinggi yang sama.

Riset perwakilan ditampilkan sebagai konteks baca pada ringkasan form, tanpa dropdown riset untuk Pengaju. Pemilihan sumber RAB membuka dropdown dokumen dan barang secara bertahap. Barang serta satuan dari sumber menjadi read-only; harga dan jumlah tetap bisa dikoreksi. Validasi submit memfokuskan dokumen atau barang yang belum dipilih, lalu field lain yang salah. Profil Pengaju memakai dropdown satu riset. Katalog dummy memakai penanda Contoh unggahan Admin; sumber impor pengguna dipertahankan.

Detail barang menghubungkan ringkasan nilai, invoice, sumber RAB, pengiriman, serta linimasa enam tahap. Linimasa horizontal menjadi vertikal pada mobile. Nominal invoice merupakan data dokumen, terpisah dari nilai request dan komitmen. Tanggal yang tidak tersedia ditampilkan sebagai belum dilengkapi. Informasi kurir/resi tidak menyiratkan integrasi pelacakan otomatis.

Dialog form dihapus. Konfirmasi tindakan, penjagaan perubahan, popup Admin dan drawer navigasi tetap memakai overlay aksesibel. Fokus menuju konten saat pindah halaman; kembali ke daftar mempertahankan URL filter dan posisi scroll. Metadata serta terminologi produk menggunakan Pembelian Barang.
