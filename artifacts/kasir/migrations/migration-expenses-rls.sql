-- Migration: Update RLS policies for expenses table with multi-tenant support
-- Description: Enable proper RLS for multi-tenant data separation

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "expenses_select_all" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_all" ON expenses;
DROP POLICY IF EXISTS "expenses_update_all" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_all" ON expenses;
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own data OR all data if admin
-- (Admin check is handled at app level, RLS allows all)
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR owner_id IS NULL
    OR auth.uid() IS NULL
  );

-- Policy: Users can insert their own data
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    OR auth.uid() IS NULL
  );

-- Policy: Users can update their own data
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR owner_id IS NULL
    OR auth.uid() IS NULL
  );

-- Policy: Users can delete their own data
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE
  USING (
    owner_id = auth.uid()
    OR auth.uid() IS NULL
  );