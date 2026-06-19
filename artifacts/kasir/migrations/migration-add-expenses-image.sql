-- Migration: Add image_url column to expenses table
-- Description: Adds an image_url column to track receipt images

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN expenses.image_url IS 'URL of the uploaded receipt image';
