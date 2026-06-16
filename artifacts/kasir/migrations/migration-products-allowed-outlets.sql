-- Add allowed_outlets jsonb column
ALTER TABLE products ADD COLUMN IF NOT EXISTS allowed_outlets JSONB DEFAULT '["all"]'::jsonb;

-- Migrate existing outlet_id data to allowed_outlets
UPDATE products
SET allowed_outlets = CASE
    WHEN outlet_id IS NULL THEN '["all"]'::jsonb
    ELSE jsonb_build_array(outlet_id::text)
END;

-- We don't drop outlet_id immediately to prevent breaking things while migrating.
-- But the new frontend logic will prefer allowed_outlets.
