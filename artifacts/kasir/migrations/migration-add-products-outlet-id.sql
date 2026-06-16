-- Migration: Add outlet_id column to products table
-- Description: Enable outlet-based filtering for products

-- Add outlet_id column
ALTER TABLE products ADD COLUMN IF NOT EXISTS outlet_id BIGINT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_outlet_id ON products(outlet_id);

-- Add foreign key constraint (if outlets table exists)
-- Using DO block to check if outlets table exists before adding constraint
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'outlets') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_outlet') THEN
            ALTER TABLE products ADD CONSTRAINT fk_products_outlet
            FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;
        END IF;
    END IF;
END
$$;

-- Grant permissions
GRANT ALL ON public.products TO anon;
GRANT ALL ON public.products TO authenticated;
