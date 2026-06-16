-- Migration: Add total_spent field to customers table
-- Run this in Supabase SQL Editor

-- Check if column already exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='customers' AND column_name='total_spent'
    ) THEN
        ALTER TABLE customers
        ADD COLUMN total_spent DECIMAL(12, 2) DEFAULT 0;

        COMMENT ON COLUMN customers.total_spent IS 'Total amount spent by customer across all transactions';
    END IF;
END $$;
