-- Migration: Add supplier column to expenses table
-- Description: Adds a supplier column to track who the expense was paid to

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier TEXT;

COMMENT ON COLUMN expenses.supplier IS 'The supplier or recipient of the payment';
