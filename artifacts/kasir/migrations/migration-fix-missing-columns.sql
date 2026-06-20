-- Migration: Fix missing columns for frontend compatibility
-- Description: Adds image_url to products, store_name to outlets, and outlet_id to customers if they don't exist.

-- 1. Add image_url to products table (if missing)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Add store_name to outlets table (if missing)
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);

-- 3. Add outlet_id to customers table (if missing)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id) ON DELETE SET NULL;

-- 4. Sync name to store_name for existing outlets
UPDATE outlets SET store_name = name WHERE store_name IS NULL;
