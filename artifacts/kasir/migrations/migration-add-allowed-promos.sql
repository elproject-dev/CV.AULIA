-- ==========================================
-- Migration to Add Allowed Promos to Discount Settings
-- ==========================================

ALTER TABLE discount_settings
ADD COLUMN allowed_promos JSONB DEFAULT '[]'::jsonb;
