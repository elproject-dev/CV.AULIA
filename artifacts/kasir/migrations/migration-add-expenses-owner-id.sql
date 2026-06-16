-- Migration: Add owner_id column to expenses table
-- Description: Enable multi-tenant data separation for expenses

-- Add owner_id column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_owner_id ON expenses(owner_id);

-- Grant permissions
GRANT ALL ON public.expenses TO anon;
GRANT ALL ON public.expenses TO authenticated;