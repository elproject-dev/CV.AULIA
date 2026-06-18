-- ======================================================
-- FINAL SUPER-OPEN SQL FOR PROMO TEMPLATES
-- RUN THIS IN SUPABASE SQL EDITOR
-- ======================================================

-- 1. Reset Table
DROP TABLE IF EXISTS public.promo_templates CASCADE;

CREATE TABLE public.promo_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Completely Disable Row Level Security
ALTER TABLE public.promo_templates DISABLE ROW LEVEL SECURITY;

-- 3. Grant Permissions to every possible role
-- This ensures the 'anon' key used by the app can access the table
GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON TABLE public.promo_templates TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON SEQUENCE public.promo_templates_id_seq TO anon, authenticated, postgres, service_role, PUBLIC;

-- 4. Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Extra check: ensure the table is actually in the public schema and accessible
COMMENT ON TABLE public.promo_templates IS 'Promo message templates accessible by everyone';
