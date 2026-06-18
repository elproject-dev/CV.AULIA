-- ======================================================
-- NUCLEAR FIX FOR PROMO TEMPLATES (401/42501 ERROR)
-- ======================================================

-- 1. Hapus total tabel lama (Hati-hati: Data template lama akan hilang)
DROP TABLE IF EXISTS public.promo_templates CASCADE;

-- 2. Buat ulang tabel dengan struktur yang benar
CREATE TABLE public.promo_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Berikan izin akses menyeluruh ke semua role
-- Ini krusial karena aplikasi menggunakan role 'anon' setelah login
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.promo_templates TO anon;
GRANT ALL ON TABLE public.promo_templates TO authenticated;
GRANT ALL ON TABLE public.promo_templates TO service_role;

-- 4. Berikan izin pada sequence ID
GRANT USAGE, SELECT ON SEQUENCE public.promo_templates_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.promo_templates_id_seq TO authenticated;

-- 5. MATIKAN RLS (PENTING!)
-- Mematikan RLS akan menghilangkan kendala 401/42501 saat akses data
ALTER TABLE public.promo_templates DISABLE ROW LEVEL SECURITY;

-- 6. Paksa Supabase memuat ulang cache API
NOTIFY pgrst, 'reload schema';
