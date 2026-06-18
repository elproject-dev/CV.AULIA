-- ==========================================
-- 1. SETUP FUNCTIONS (RUN THIS FIRST)
-- ==========================================

-- Function to check if user is Admin
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
  OR lower(auth.jwt() ->> 'email') = 'sbagiamu.pos@gmail.com';
$$;

-- Function to automatically set owner_id
CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  RETURN NEW;
END; $$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_owner_id() TO authenticated;


-- ==========================================
-- 2. CREATE TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.promo_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 3. ENABLE SECURITY (RLS)
-- ==========================================

ALTER TABLE public.promo_templates ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can view their own promo templates" 
    ON public.promo_templates FOR SELECT 
    USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can insert their own promo templates" 
    ON public.promo_templates FOR INSERT 
    WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can update their own promo templates" 
    ON public.promo_templates FOR UPDATE 
    USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can delete their own promo templates" 
    ON public.promo_templates FOR DELETE 
    USING (auth.uid() = owner_id OR public.is_admin());


-- ==========================================
-- 4. SETUP TRIGGER
-- ==========================================

DROP TRIGGER IF EXISTS trg_promo_templates_set_owner ON public.promo_templates;
CREATE TRIGGER trg_promo_templates_set_owner 
    BEFORE INSERT ON public.promo_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- Grant table permissions
GRANT ALL ON public.promo_templates TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE promo_templates_id_seq TO authenticated;
