-- Migration: Add payment confirmation flow for sales payments
-- Adds status, confirmed_by, and confirmed_at columns to transaction_payments table
-- Default 'confirmed' so existing data is unaffected

ALTER TABLE transaction_payments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Index for faster query of pending payments
CREATE INDEX IF NOT EXISTS idx_transaction_payments_status
  ON transaction_payments (status);
