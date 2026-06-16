-- Grant permissions to anon + authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staff TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transaction_items TO anon, authenticated;

-- Grant sequence permissions explicitly (USAGE + UPDATE diperlukan untuk INSERT)
GRANT USAGE, SELECT, UPDATE ON SEQUENCE categories_id_seq TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE products_id_seq TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE customers_id_seq TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE staff_id_seq TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE transactions_id_seq TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE transaction_items_id_seq TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated;

-- Enable Row Level Security on existing tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public access (using anon key)
DROP POLICY IF EXISTS "Allow public read on categories" ON categories;
CREATE POLICY "Allow public read on categories" ON categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on categories" ON categories;
CREATE POLICY "Allow public insert on categories" ON categories
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on categories" ON categories;
CREATE POLICY "Allow public update on categories" ON categories
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete on categories" ON categories;
CREATE POLICY "Allow public delete on categories" ON categories
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on products" ON products;
CREATE POLICY "Allow public read on products" ON products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on products" ON products;
CREATE POLICY "Allow public insert on products" ON products
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on products" ON products;
CREATE POLICY "Allow public update on products" ON products
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete on products" ON products;
CREATE POLICY "Allow public delete on products" ON products
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on customers" ON customers;
CREATE POLICY "Allow public read on customers" ON customers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on customers" ON customers;
CREATE POLICY "Allow public insert on customers" ON customers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on customers" ON customers;
CREATE POLICY "Allow public update on customers" ON customers
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete on customers" ON customers;
CREATE POLICY "Allow public delete on customers" ON customers
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on staff" ON staff;
CREATE POLICY "Allow public read on staff" ON staff
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on staff" ON staff;
CREATE POLICY "Allow public insert on staff" ON staff
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on staff" ON staff;
CREATE POLICY "Allow public update on staff" ON staff
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete on staff" ON staff;
CREATE POLICY "Allow public delete on staff" ON staff
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on transactions" ON transactions;
CREATE POLICY "Allow public read on transactions" ON transactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on transactions" ON transactions;
CREATE POLICY "Allow public insert on transactions" ON transactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on transactions" ON transactions;
CREATE POLICY "Allow public update on transactions" ON transactions
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on transactions" ON transactions;
CREATE POLICY "Allow public delete on transactions" ON transactions
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on transaction_items" ON transaction_items;
CREATE POLICY "Allow public read on transaction_items" ON transaction_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on transaction_items" ON transaction_items;
CREATE POLICY "Allow public insert on transaction_items" ON transaction_items
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on transaction_items" ON transaction_items;
CREATE POLICY "Allow public update on transaction_items" ON transaction_items
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on transaction_items" ON transaction_items;
CREATE POLICY "Allow public delete on transaction_items" ON transaction_items
  FOR DELETE USING (true);

-- Note: Storage bucket policies for product-images must be configured
-- through the Supabase Dashboard UI at:
-- Storage > product-images > Policies
-- Create the following policies:
-- 1. INSERT policy for anon, authenticated roles (bucket_id = 'product-images')
-- 2. SELECT policy for anon, authenticated roles (bucket_id = 'product-images')
-- 3. DELETE policy for anon, authenticated roles (bucket_id = 'product-images')
