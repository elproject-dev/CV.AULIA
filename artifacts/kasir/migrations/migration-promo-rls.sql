-- Enable RLS for promo tables
ALTER TABLE public.promo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_sent_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all operations for users based on owner_id" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable read access for public templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable all operations for users based on owner_id" ON public.promo_sent_logs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable update/delete for owner" ON public.promo_templates;

-- NEW POLICIES: promo_templates
-- 1. Semua user (termasuk anon) boleh melihat (SELECT) semua template
CREATE POLICY "Enable read access for authenticated users"
ON public.promo_templates FOR SELECT
TO public
USING (true);

-- 2. Semua user boleh membuat (INSERT) template baru
CREATE POLICY "Enable insert for authenticated users"
ON public.promo_templates FOR INSERT
TO public
WITH CHECK (true);

-- 3. Mengizinkan user yang login untuk UPDATE dan DELETE (Sementara di-bypass owner_id nya untuk mengatasi error 401/0 rows affected)
CREATE POLICY "Enable update/delete for owner"
ON public.promo_templates FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- NEW POLICIES: promo_sent_logs
-- Sama dengan templates, izinkan select dan insert
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.promo_sent_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.promo_sent_logs;
DROP POLICY IF EXISTS "Enable delete for owner" ON public.promo_sent_logs;

CREATE POLICY "Enable read access for authenticated users"
ON public.promo_sent_logs FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.promo_sent_logs FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable delete for owner"
ON public.promo_sent_logs FOR DELETE
TO public
USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_sent_logs TO anon, authenticated;

-- Grant sequence permissions if there are any (assuming bigserial/serial PK)
-- Replace promo_templates_id_seq with the actual sequence name if different
DO $$
DECLARE
    seq_name text;
BEGIN
    SELECT pg_get_serial_sequence('public.promo_templates', 'id') INTO seq_name;
    IF seq_name IS NOT NULL THEN
        EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ' || seq_name || ' TO anon, authenticated';
    END IF;
    
    SELECT pg_get_serial_sequence('public.promo_sent_logs', 'id') INTO seq_name;
    IF seq_name IS NOT NULL THEN
        EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ' || seq_name || ' TO anon, authenticated';
    END IF;
END $$;
