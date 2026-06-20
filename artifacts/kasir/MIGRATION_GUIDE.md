# 🚀 Panduan Migrasi Supabase & Templatisasi Project (Kasir POS)

Dokumen ini menjelaskan cara cepat melakukan migrasi database Supabase dan mengonfigurasi project ini sebagai template untuk digunakan oleh client baru.

---

## 📋 Ringkasan File Baru/Modifikasi

Untuk mempermudah proses templatisasi, kami telah menyediakan:
1. **[`.env.example`](file:///c:/Users/Administrator/Music/CV%20AULIA/artifacts/kasir/.env.example)**: Template variabel environment untuk client baru.
2. **[`migrations/complete-schema.sql`](file:///c:/Users/Administrator/Music/CV%20AULIA/artifacts/kasir/migrations/complete-schema.sql)**: File konsolidasi dari seluruh 40+ migrasi SQL (termasuk pembuatan table, trigger, index, RLS, policy, serta inisialisasi storage bucket).
3. **[`scripts/generate-complete-schema.mjs`](file:///c:/Users/Administrator/Music/CV%20AULIA/artifacts/kasir/scripts/generate-complete-schema.mjs)**: Script Node.js untuk meregenerasi file `complete-schema.sql` secara otomatis jika ada penambahan migrasi di kemudian hari.
4. **[`package.json`](file:///c:/Users/Administrator/Music/CV%20AULIA/artifacts/kasir/package.json)**: Ditambahkan script `"db:compile-schema"` untuk mempermudah menjalankan script regenerasi.

---

## 🛠️ Langkah Cepat Migrasi untuk Client Baru (Hanya 3 Langkah)

Jika Anda ingin mendistribusikan aplikasi ini ke client baru dengan database Supabase baru, cukup ikuti 3 langkah berikut:

### Langkah 1: Buat Project Supabase Baru & Dapatkan Kredensial

1. Masuk ke [Supabase Console](https://supabase.com/) dan buat project baru.
2. Tunggu proses pembuatan database selesai.
3. Buka **Project Settings** → **API**:
   - Salin **Project URL** (Gunakan sebagai `VITE_SUPABASE_URL`).
   - Salin **anon public API Key** (Gunakan sebagai `VITE_SUPABASE_ANON_KEY`).
4. Buka **Project Settings** → **Database**:
   - Salin **Connection String** (jika ingin menggunakan akses postgresql langsung).

---

### Langkah 2: Setup Database (Salin & Jalankan SQL)

Kami telah menyatukan semua tabel, trigger, RLS, dan storage bucket ke dalam satu file SQL tunggal. Anda tidak perlu menjalankan 44 file migrasi secara manual.

1. Buka file **[`migrations/complete-schema.sql`](file:///c:/Users/Administrator/Music/CV%20AULIA/artifacts/kasir/migrations/complete-schema.sql)** di project Anda.
2. Salin (Copy) seluruh isi file tersebut.
3. Buka **Supabase Dashboard** client baru Anda → **SQL Editor** → **New Query**.
4. Tempel (Paste) SQL yang telah disalin, lalu klik **Run** (Jalankan).

> [!NOTE]
> SQL ini secara otomatis melakukan hal berikut:
> - Membuat semua tabel utama (`categories`, `products`, `customers`, `staff`, `transactions`, `transaction_items`, `outlets`, `expenses`, `promo_templates`, `point_settings`, dll).
> - Membuat trigger untuk pembaruan timestamp `updated_at` dan RLS Multi-Tenant (`owner_id`).
> - Membuat storage bucket **`product-images`** dan **`expense-receipts`** secara otomatis dengan status Public.
> - Mengonfigurasi seluruh Policy RLS (Row Level Security) untuk keamanan data multi-tenant dan hak akses bucket storage.
> - Memasukkan data awal (seed data) untuk kategori, produk, dan staff contoh.

---

### Langkah 3: Konfigurasi Environment File `.env`

1. Buat salinan file `.env.example` dan ubah namanya menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
2. Isi nilai di dalamnya dengan kredensial API Supabase baru dari **Langkah 1**:
   ```env
   VITE_SUPABASE_URL=https://<project-ref-baru>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key-baru-anda>
   ```

Aplikasi sekarang sudah terhubung dengan Supabase baru dan siap digunakan oleh client!

---

## 🔒 Konfigurasi Akun Administrator (Sangat Penting)

Aplikasi ini menggunakan email hardcoded untuk hak akses administrator tertinggi di database RLS dan kode frontend. 

1. **Email Admin Default**: `sbagiamu.pos@gmail.com`
2. Jika client baru memiliki email admin sendiri (misal: `admin@clientbaru.com`):
   - **Langkah Kode**: Ubah file **[`src/lib/auth.ts`](file:///c:/Users/Administrator/Music/CV%20AULIA/artifacts/kasir/src/lib/auth.ts#L9)** pada bagian email admin:
     ```typescript
     // Ganti email admin sesuai client Anda
     export const ADMIN_EMAIL = "admin@clientbaru.com";
     ```
   - **Langkah Database**: Pada file `migrations/complete-schema.sql` (atau jalankan query SQL baru di Dashboard), sesuaikan fungsi `is_admin()` agar mengenali email admin yang baru:
     ```sql
     CREATE OR REPLACE FUNCTION public.is_admin()
     RETURNS boolean
     LANGUAGE sql
     STABLE
     SECURITY DEFINER
     SET search_path = public
     AS $$
       SELECT COALESCE(
         lower(auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
         false
       )
       OR lower(auth.jwt() ->> 'email') = 'admin@clientbaru.com'; -- Ganti di sini
     $$;
     ```

---

## 👥 Cara Menambahkan User Kasir Baru

Karena arsitektur multi-tenant, setiap kasir akan memiliki datanya masing-masing (`owner_id` terikat ke user ID Supabase Auth).

1. Registrasi kasir baru dapat dilakukan langsung melalui aplikasi pada halaman Registrasi/Register, atau ditambahkan via **Supabase Dashboard** → **Authentication** → **Add user**.
2. Pastikan saat registrasi kasir baru, data user metadata memiliki key `"role": "kasir"` (ini otomatis dilakukan jika mendaftar lewat form registrasi bawaan aplikasi).

---

## 🔄 Cara Mengupdate Template di Masa Depan

Jika di kemudian hari Anda menambahkan file migrasi baru (misalnya `migration-fitur-baru.sql` di dalam folder `migrations/`), Anda dapat memperbarui file `complete-schema.sql` secara otomatis dengan:

1. Daftarkan nama file SQL baru tersebut ke dalam array `migrationFiles` di file **[`scripts/generate-complete-schema.mjs`](file:///c:/Users/Administrator/Music/CV%20AULIA/artifacts/kasir/scripts/generate-complete-schema.mjs)**.
2. Jalankan perintah terminal:
   ```bash
   npm run db:compile-schema
   ```
   *Perintah ini akan menggabungkan ulang semua migrasi secara berurutan ke dalam `complete-schema.sql` agar siap digunakan oleh client berikutnya.*

---

**Selamat Mencoba! Project Anda sekarang siap didistribusikan ke berbagai client secara cepat.** 🎉
