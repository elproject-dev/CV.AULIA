-- Migration: Add outlet_id column to expenses table
-- Description: Enable outlet-based filtering for expenses

-- Add outlet_id column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS outlet_id INTEGER;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_outlet_id ON expenses(outlet_id);

-- Add foreign key constraint (optional, if outlets table exists)
-- ALTER TABLE expenses ADD CONSTRAINT fk_expenses_outlet
--   FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;

-- Grant permissions
GRANT ALL ON public.expenses TO anon;
GRANT ALL ON public.expenses TO authenticated;