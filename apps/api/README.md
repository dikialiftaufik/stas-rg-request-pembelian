# @stas/api — Backend NestJS STAS-RG Pembelian Barang

Backend REST API berbasis **NestJS**, **Prisma ORM**, dan **PostgreSQL** untuk portal Pembelian Barang STAS-RG.

## Stack Utama

- **Framework:** NestJS 12 (`@nestjs/core`, `@nestjs/platform-express`)
- **ORM & Database:** Prisma 6 (`@prisma/client`) + PostgreSQL (`Decimal(18,2)` untuk seluruh nilai uang)
- **Autentikasi:** JWT (`@nestjs/jwt`) di dalam **HttpOnly Cookie** (`stas_access_token`) + hashing `bcryptjs`
- **Validasi:** `zod` (konsisten dengan `@stas/web`)

## Persiapan Awal (PostgreSQL & Prisma)

1. Pastikan layanan **PostgreSQL** berjalan dan buat database (misalnya `stas_request_pembelian`).
2. Salin konfigurasi `.env.example` menjadi `.env` di dalam `apps/api`, lalu sesuaikan kredensial PostgreSQL pada `DATABASE_URL` serta `JWT_SECRET`:
   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   ```
3. Jalankan generate Prisma Client, migrasi database, dan seed awal (akun Admin) dari folder `stas-rg-request-pembelian`:

   ```powershell
   npx pnpm@12.15.0 --filter @stas/api prisma:generate
   npx pnpm@12.15.0 --filter @stas/api prisma:migrate
   npx pnpm@12.15.0 --filter @stas/api prisma:seed
   ```

   > Kredensial seed Admin default mengikuti `.env` (`admin@gmail.com` / `admin123`) untuk keperluan pengembangan lokal. Ubah nilai tersebut sebelum masuk lingkungan produksi.

4. Jalankan server API pengembangan:
   ```powershell
   npx pnpm@12.15.0 dev:api
   ```
   Server berjalan secara default di `http://127.0.0.1:3000/api/v1`.

---

## Kontrak Endpoint API (`/api/v1`)

### A. Autentikasi Admin (`/api/v1/auth/admin`)

| Method | Endpoint                    | Akses                       | Deskripsi                                                                                                |
| :----- | :-------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/auth/admin/login`  | Publik (khusus Admin aktif) | Login `{ email, password }`, set cookie `HttpOnly` `stas_access_token`, kembalikan `{ data: { user } }`. |
| `GET`  | `/api/v1/auth/admin/me`     | Admin (`HttpOnly` cookie)   | Mengecek sesi Admin aktif & mengembalikan `{ data: { user } }`.                                          |
| `POST` | `/api/v1/auth/admin/logout` | Publik / Sesi aktif         | Menghapus cookie `HttpOnly` `stas_access_token`.                                                         |

---

### B. CRUD Jenis Riset (`/api/v1/research-types`) — Khusus Admin

Seluruh endpoint di bawah ini wajib menyertakan cookie sesi Admin (`JwtCookieAuthGuard` + `RolesGuard` `@Roles('admin')`).

#### 1. Daftar & Rekap Dana Jenis Riset — `GET /api/v1/research-types`

- **Query Opsional:** `?q=<kata-kunci>` (mencari pada `name` atau `description` secara _case-insensitive_).
- **Catatan Rekap:** `meta.summary` selalu menghitung total alokasi, komitmen, dan sisa dana dari **seluruh** riset aktif meskipun daftar sedang difilter dengan `?q=...`.
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "smart",
        "name": "Smart Mannequin",
        "description": "Proyek riset Smart Mannequin.",
        "allocated": "75000000",
        "committed": "0",
        "remaining": "75000000",
        "requestCount": 0,
        "createdAt": "2026-11-04T06:00:00.000Z",
        "updatedAt": "2026-11-04T06:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "summary": {
        "totalAllocated": "342000000",
        "totalCommitted": "0",
        "totalRemaining": "342000000"
      }
    }
  }
  ```

#### 2. Detail Jenis Riset — `GET /api/v1/research-types/:id`

- **Response (`200 OK`):** `{ "data": { ... } }`
- **Error:** `404 Not Found` (`Jenis riset tidak ditemukan.`)

#### 3. Tambah Jenis Riset — `POST /api/v1/research-types`

- **Request Body (`application/json`):**
  ```json
  {
    "name": "Smart Mannequin",
    "description": "Proyek riset Smart Mannequin.",
    "allocated": "75000000"
  }
  ```
- **Aturan:**
  - `name` wajib diisi (maks 150 karakter) dan unik secara _case-insensitive_.
  - `description` opsional (default `""`, maks 2.000 karakter).
  - `allocated` berupa string nominal positif valid (maksimal 2 angka desimal, `> 0`).
- **Response (`201 Created`):** `{ "data": { ... } }`
- **Error:** `400 Bad Request` (validasi gagal), `409 Conflict` (`Nama jenis riset sudah digunakan.`).

#### 4. Edit Jenis Riset — `PATCH /api/v1/research-types/:id` (atau `PUT /api/v1/research-types/:id`)

- **Request Body (`PATCH`):** Minimal satu field dari `{ "name"?, "description"?, "allocated"? }`.
- **Aturan Bisnis:**
  - Nama baru tidak boleh bentrok dengan riset lain (`409 Conflict`).
  - Nilai `allocated` baru **tidak boleh lebih kecil daripada dana yang sudah berkomitmen (`committed`)** (`400 Bad Request`: `Alokasi tidak boleh lebih kecil daripada dana yang digunakan.`).
- **Response (`200 OK`):** `{ "data": { ... } }`

#### 5. Hapus Jenis Riset — `DELETE /api/v1/research-types/:id`

- **Aturan Bisnis:** Riset yang masih memiliki dokumen RAB, dirujuk oleh request pembelian, atau memiliki perwakilan pengguna (`user_research_assignments`) **ditolak penghapusannya** dengan `409 Conflict`.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "smart",
      "deleted": true
    }
  }
  ```

---

### C. Health Check — `GET /api/v1/health`

- **Response (`200 OK`):** `{ "data": { "status": "ok", "service": "@stas/api" } }`
