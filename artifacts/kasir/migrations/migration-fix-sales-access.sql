-- Perbaiki akses data untuk role anon (dipakai aplikasi setelah login)
-- Jalankan di Supabase SQL Editor — jika error 42501, buat policy via Dashboard:
--   Database → Tables → customers → RLS → New Policy → Enable read/insert/update untuk anon

-- Grant ke anon (role yang dipakai query data)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON transaction_items TO anon;

GRANT USAGE, SELECT, UPDATE ON SEQUENCE customers_id_seq TO anon;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE products_id_seq TO anon;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE categories_id_seq TO anon;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE transactions_id_seq TO anon;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE transaction_items_id_seq TO anon;

-- Pulihkan policy publik jika sempat terhapus
DROP POLICY IF EXISTS "Allow public read on customers" ON customers;
CREATE POLICY "Allow public read on customers" ON customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on customers" ON customers;
CREATE POLICY "Allow public insert on customers" ON customers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on customers" ON customers;
CREATE POLICY "Allow public update on customers" ON customers FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete on customers" ON customers;
CREATE POLICY "Allow public delete on customers" ON customers FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on products" ON products;
CREATE POLICY "Allow public read on products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on products" ON products;
CREATE POLICY "Allow public insert on products" ON products FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on products" ON products;
CREATE POLICY "Allow public update on products" ON products FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete on products" ON products;
CREATE POLICY "Allow public delete on products" ON products FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on categories" ON categories;
CREATE POLICY "Allow public read on categories" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on categories" ON categories;
CREATE POLICY "Allow public insert on categories" ON categories FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on categories" ON categories;
CREATE POLICY "Allow public update on categories" ON categories FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete on categories" ON categories;
CREATE POLICY "Allow public delete on categories" ON categories FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on transactions" ON transactions;
CREATE POLICY "Allow public read on transactions" ON transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on transactions" ON transactions;
CREATE POLICY "Allow public insert on transactions" ON transactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on transactions" ON transactions;
CREATE POLICY "Allow public update on transactions" ON transactions FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete on transactions" ON transactions;
CREATE POLICY "Allow public delete on transactions" ON transactions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on transaction_items" ON transaction_items;
CREATE POLICY "Allow public read on transaction_items" ON transaction_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on transaction_items" ON transaction_items;
CREATE POLICY "Allow public insert on transaction_items" ON transaction_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on transaction_items" ON transaction_items;
CREATE POLICY "Allow public update on transaction_items" ON transaction_items FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete on transaction_items" ON transaction_items;
CREATE POLICY "Allow public delete on transaction_items" ON transaction_items FOR DELETE USING (true);
