-- Migration: Setup storage for expense receipts
-- Description: Creates the expense-receipts bucket and sets up RLS policies

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the new bucket
-- Enable RLS (though storage.objects should already have it enabled)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete expense receipts" ON storage.objects;

-- Create policies
-- Allow public viewing of receipts (since it's a public bucket, we need a select policy)
CREATE POLICY "Anyone can view expense receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-receipts');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload expense receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expense-receipts');

-- Allow anon to upload (for compatibility with current app's kasir login mechanism which uses anon role)
CREATE POLICY "Anon can upload expense receipts"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'expense-receipts');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update expense receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'expense-receipts');

-- Allow anon to update
CREATE POLICY "Anon can update expense receipts"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'expense-receipts');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete expense receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expense-receipts');

-- Allow anon to delete
CREATE POLICY "Anon can delete expense receipts"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'expense-receipts');
