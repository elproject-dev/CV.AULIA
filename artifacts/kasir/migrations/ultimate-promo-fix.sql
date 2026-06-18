-- ======================================================
-- ULTIMATE FIX FOR PROMO TEMPLATES (401 UNAUTHORIZED)
-- ======================================================

-- 1. Hapus tabel lama agar benar-benar fresh
DROP TABLE IF EXISTS public.promo_templates CASCADE;

-- 2. Buat ulang tabel dengan struktur paling sederhana
-- Menggunakan SERIAL agar sequence otomatis terurus
CREATE TABLE public.promo_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Matikan semua sistem keamanan RLS untuk tabel ini
-- Ini akan mengizinkan akses tanpa memerlukan token JWT yang valid
ALTER TABLE public.promo_templates DISABLE ROW LEVEL SECURITY;

-- 4. Berikan izin akses penuh ke semua jenis role
GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON TABLE public.promo_templates TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON SEQUENCE public.promo_templates_id_seq TO anon, authenticated, postgres, service_role, PUBLIC;

-- 5. Paksa Supabase/PostgREST untuk memuat ulang definisi tabel
NOTIFY pgrst, 'reload schema';
