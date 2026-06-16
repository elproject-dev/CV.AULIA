-- DEPRECATED: Grant sudah termasuk di migration-multi-tenant-kasir.sql
-- Aplikasi kasir sekarang WAJIB memakai session authenticated (RLS multi-tenant).

-- 1. Schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Tabel
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transaction_items TO authenticated;

-- 3. Sequence (WAJIB — tanpa ini INSERT gagal)
GRANT USAGE, SELECT, UPDATE ON SEQUENCE categories_id_seq TO authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE products_id_seq TO authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE customers_id_seq TO authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE staff_id_seq TO authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE transactions_id_seq TO authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE transaction_items_id_seq TO authenticated;

-- 4. Sequence baru di masa depan
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated;

-- 5. Policy update transaksi (jika belum ada)
DROP POLICY IF EXISTS "Allow public update on transactions" ON transactions;
CREATE POLICY "Allow public update on transactions" ON transactions
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on transaction_items" ON transaction_items;
CREATE POLICY "Allow public update on transaction_items" ON transaction_items
  FOR UPDATE USING (true) WITH CHECK (true);
