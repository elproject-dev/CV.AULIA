-- Migration: Add footer settings to outlets table
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS footer_message TEXT;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS footer_message2 TEXT;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS footer_message3 TEXT;
