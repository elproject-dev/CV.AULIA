-- ======================================================
-- FIX PERMISSIONS FOR PROMO TEMPLATES
-- ======================================================

-- 1. Ensure schema usage permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Grant explicit table permissions
GRANT ALL ON TABLE public.promo_templates TO authenticated;
GRANT ALL ON TABLE public.promo_templates TO service_role;

-- 3. Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE public.promo_templates_id_seq TO authenticated;

-- 4. Re-configure Policies to be more robust
-- Drop existing ones first
DROP POLICY IF EXISTS "Users can view their own promo templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Users can insert their own promo templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Users can update their own promo templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Users can delete their own promo templates" ON public.promo_templates;

-- View: Allow all authenticated users to view (simpler)
CREATE POLICY "Users can view their own promo templates" 
    ON public.promo_templates FOR SELECT 
    TO authenticated
    USING (true);

-- Insert: Must be authenticated
CREATE POLICY "Users can insert their own promo templates" 
    ON public.promo_templates FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- Update: Owner or Admin
CREATE POLICY "Users can update their own promo templates" 
    ON public.promo_templates FOR UPDATE 
    TO authenticated
    USING (auth.uid() = owner_id OR public.is_admin());

-- Delete: Owner or Admin
CREATE POLICY "Users can delete their own promo templates" 
    ON public.promo_templates FOR DELETE 
    TO authenticated
    USING (auth.uid() = owner_id OR public.is_admin());

-- 5. Ensure the owner_id trigger is active
DROP TRIGGER IF EXISTS trg_promo_templates_set_owner ON public.promo_templates;
CREATE TRIGGER trg_promo_templates_set_owner 
    BEFORE INSERT ON public.promo_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
