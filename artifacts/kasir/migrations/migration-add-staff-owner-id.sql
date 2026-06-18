-- Migration: Add owner_id to staff table
-- Description: Links staff records to Supabase Auth users for multi-tenant mapping

ALTER TABLE staff ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_staff_owner_id ON staff(owner_id);

-- Update existing staff records based on avatar_url if possible (HACK for existing data)
-- This extracts the UUID from the avatar URL if it exists
UPDATE staff 
SET owner_id = (substring(avatar_url from '/avatars/([0-9a-f-]{36})_'))::uuid
WHERE owner_id IS NULL AND avatar_url IS NOT NULL AND avatar_url ~ '/avatars/[0-9a-f-]{36}_';
