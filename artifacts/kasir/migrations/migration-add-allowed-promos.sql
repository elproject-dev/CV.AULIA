-- ==========================================
-- Migration to Add Allowed Promos to Discount Settings
-- ==========================================

ALTER TABLE discount_settings
ADD COLUMN IF NOT EXISTS allowed_promos JSONB DEFAULT '[]'::jsonb;
