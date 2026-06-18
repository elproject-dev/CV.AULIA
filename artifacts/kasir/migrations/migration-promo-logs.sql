-- ======================================================
-- CREATE PROMO SENT LOGS TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS public.promo_sent_logs (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL, 
    template_id BIGINT,          
    owner_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matikan RLS agar tidak ada error 401 saat menyimpan log
ALTER TABLE public.promo_sent_logs DISABLE ROW LEVEL SECURITY;

-- Berikan izin akses penuh ke semua role (termasuk anon)
GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON TABLE public.promo_sent_logs TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON SEQUENCE public.promo_sent_logs_id_seq TO anon, authenticated, postgres, service_role, PUBLIC;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';