-- Migration: Add discount_note & customer_type to transactions table
-- Jalankan di Supabase Dashboard → SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'discount_note'
    ) THEN
        ALTER TABLE transactions
        ADD COLUMN discount_note VARCHAR(255);

        COMMENT ON COLUMN transactions.discount_note IS 'Keterangan atau alasan diskon pada transaksi';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'customer_type'
    ) THEN
        ALTER TABLE transactions
        ADD COLUMN customer_type VARCHAR(50) DEFAULT 'non_member';

        COMMENT ON COLUMN transactions.customer_type IS 'Tipe pelanggan saat transaksi: member atau non_member';
    END IF;
END $$;

-- Isi status pelanggan dari data customers yang sudah ada
UPDATE transactions t
SET customer_type = COALESCE(c.membership_type, 'non_member')
FROM customers c
WHERE t.customer_id = c.id
  AND (t.customer_type IS NULL OR t.customer_type = 'non_member');
