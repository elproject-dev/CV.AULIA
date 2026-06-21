-- Migration: Add status to expenses
-- Description: Adds a status column to expenses table for approval workflow

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';

-- Optional: update existing rows to be sure
UPDATE public.expenses SET status = 'approved' WHERE status IS NULL;
