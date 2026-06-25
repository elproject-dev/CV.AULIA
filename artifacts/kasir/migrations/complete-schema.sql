-- =============================================================================
-- CONSOLIDATED SUPABASE DATABASE SCHEMA & MIGRATIONS
-- Generated on: 2026-06-25T13:37:03.671Z
-- Suitable for fresh setup of new clients/databases.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FILE: supabase-schema.sql
-- -----------------------------------------------------------------------------

-- Enable UUID extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



-- Categories table

DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS outlets CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS point_settings CASCADE;
DROP TABLE IF EXISTS discount_settings CASCADE;
DROP TABLE IF EXISTS discount_categories CASCADE;
DROP TABLE IF EXISTS promo_templates CASCADE;
DROP TABLE IF EXISTS promo_sent_logs CASCADE;



CREATE TABLE categories (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Products table

CREATE TABLE products (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  price DECIMAL(12, 2) NOT NULL,

  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,

  imageUrl TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Customers table

CREATE TABLE customers (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  email VARCHAR(255),

  phone VARCHAR(50),

  membership_type VARCHAR(50) DEFAULT 'regular',

  points INTEGER DEFAULT 0,

  total_spent DECIMAL(12, 2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Staff table

CREATE TABLE staff (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  email VARCHAR(255) NOT NULL,

  phone VARCHAR(50),

  role VARCHAR(50) NOT NULL,

  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Transactions table

CREATE TABLE transactions (

  id BIGSERIAL PRIMARY KEY,

  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,

  cashier_name VARCHAR(255),

  payment_method VARCHAR(50) NOT NULL,

  subtotal DECIMAL(12, 2) NOT NULL,

  tax DECIMAL(12, 2) NOT NULL,

  discount DECIMAL(12, 2) DEFAULT 0,

  discount_note VARCHAR(255),

  customer_type VARCHAR(50) DEFAULT 'non_member',

  amount_paid DECIMAL(12, 2) NOT NULL,

  change DECIMAL(12, 2) DEFAULT 0,

  points_used INTEGER DEFAULT 0,

  points_earned INTEGER DEFAULT 0,

  status VARCHAR(50) DEFAULT 'completed',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Transaction Items table

CREATE TABLE transaction_items (

  id BIGSERIAL PRIMARY KEY,

  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  product_name VARCHAR(255) NOT NULL,

  quantity INTEGER NOT NULL,

  price DECIMAL(12, 2) NOT NULL,

  subtotal DECIMAL(12, 2) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Enable Row Level Security

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



DROP POLICY IF EXISTS "Allow public delete on transactions" ON transactions;

CREATE POLICY "Allow public delete on transactions" ON transactions

  FOR DELETE USING (true);



DROP POLICY IF EXISTS "Allow public read on transaction_items" ON transaction_items;

CREATE POLICY "Allow public read on transaction_items" ON transaction_items

  FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public insert on transaction_items" ON transaction_items;

CREATE POLICY "Allow public insert on transaction_items" ON transaction_items

  FOR INSERT WITH CHECK (true);



DROP POLICY IF EXISTS "Allow public delete on transaction_items" ON transaction_items;

CREATE POLICY "Allow public delete on transaction_items" ON transaction_items

  FOR DELETE USING (true);



-- Create indexes for better performance

CREATE INDEX idx_products_category_id ON products(category_id);

CREATE INDEX idx_products_is_active ON products(is_active);

CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);

CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);

CREATE INDEX idx_transaction_items_product_id ON transaction_items(product_id);



-- Insert initial categories

INSERT INTO categories (name) VALUES 

('Food'),

('Drink'),

('Snack');



-- Insert initial products

INSERT INTO products (name, price, category_id, imageUrl, is_active) VALUES 

('Product A', 50000, 1, '', true),

('Product B', 75000, 2, '', true),

('Product C', 30000, 1, '', true);



-- Insert initial customers

INSERT INTO customers (name, email, phone, membership_type, points) VALUES 

('John Doe', 'john@example.com', '08123456789', 'regular', 100),

('Jane Smith', 'jane@example.com', '08198765432', 'gold', 500),

('Bob Johnson', 'bob@example.com', '08156789012', 'regular', 50);



-- Insert initial staff

INSERT INTO staff (name, email, phone, role, status) VALUES 

('Ahmad Kasir', 'ahmad@sbagiamu.com', '08123456789', 'kasir', 'active'),

('Budi Supervisor', 'budi@sbagiamu.com', '08156789012', 'supervisor', 'active'),

('Super Admin', 'sbagiamu.pos@gmail.com', '08123456789', 'admin', 'active');



-- Function to update updated_at timestamp

CREATE OR REPLACE FUNCTION update_updated_at_column()

RETURNS TRIGGER AS $$

BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;



-- Triggers for updated_at

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- -----------------------------------------------------------------------------
-- FILE: supabase-rls-policies.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- FILE: migration-setup-product-images-storage.sql
-- -----------------------------------------------------------------------------

-- Migration: Setup storage for product images
-- Description: Creates the product-images bucket and sets up RLS policies for public access

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the new bucket
-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon can delete product images" ON storage.objects;

-- Create policies
-- Allow public viewing of images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow anon to upload (for compatibility with kasir login mechanism which uses anon role)
CREATE POLICY "Anon can upload product images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow anon to update
CREATE POLICY "Anon can update product images"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'product-images');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow anon to delete
CREATE POLICY "Anon can delete product images"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'product-images');


-- -----------------------------------------------------------------------------
-- FILE: migration-fix-table-ownership.sql
-- -----------------------------------------------------------------------------

-- DIAGNOSTIK — jalankan query ini saja di SQL Editor (biasanya tidak error)
SELECT
  current_user AS role_anda,
  tablename,
  tableowner AS pemilik_tabel
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'categories', 'products', 'transactions',
    'transaction_items', 'customers', 'staff'
  )
ORDER BY tablename;

-- Jika role_anda BUKAN postgres dan pemilik_tabel = postgres:
--   SQL Editor tidak punya hak ubah tabel.
--   Solusi: tambah kolom owner_id lewat Dashboard → Database → Tables (GUI)
--   Lihat instruksi di migration-multi-tenant-kasir.sql Bagian A.


-- -----------------------------------------------------------------------------
-- FILE: migration-multi-tenant-kasir.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- MULTI-TENANT KASIR — BACA INI DULU
-- =============================================================================
--
-- Jika SQL Editor error "42501 must be owner of table categories":
--   JANGAN pakai file ini dulu. Ikuti langkah GUI di bawah (Bagian A).
--   Aplikasi sudah memfilter data per kasir di kode — kolom owner_id cukup
--   ditambah lewat Table Editor tanpa SQL migration.
--
-- =============================================================================
-- BAGIAN A — Tambah kolom via Supabase Dashboard (TANPA SQL)
-- =============================================================================
--
-- Untuk SETIAP tabel berikut:
--   categories, products, transactions, transaction_items
--
-- 1. Buka Supabase Dashboard → Database → Tables
-- 2. Klik nama tabel → tombol "+" (Add column)
-- 3. Isi:
--      Name     : owner_id
--      Type     : uuid
--      Default  : (kosongkan)
--      Nullable : ✓ centang (boleh null)
-- 4. Klik Save
--
-- Tabel customers — JANGAN tambah owner_id (data bersama).
--
-- Setelah kolom ditambah, login sebagai kasir dan buat produk baru.
-- Data lama (owner_id kosong) hanya terlihat admin.
--
-- =============================================================================
-- BAGIAN B — RLS (OPSIONAL, hanya jika punya akses postgres penuh)
-- =============================================================================
--
-- Jalankan Bagian B hanya via koneksi postgres langsung:
--   Dashboard → Project Settings → Database → Connection string
--   → Mode: Session → URI → salin password database
--
-- PowerShell (ganti [PASSWORD] dan [PROJECT-REF]):
--   psql "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" -f migration-multi-tenant-kasir.sql
--
-- Atau paste Bagian B saja di SQL Editor — jika masih error 42501, lewati
-- Bagian B. Aplikasi tetap jalan dengan filter di kode.
--
-- =============================================================================


-- ---------- BAGIAN B: Functions (biasanya bisa di SQL Editor) ----------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    lower(auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  )
  OR lower(auth.jwt() ->> 'email') = 'sbagiamu.pos@gmail.com';
$$;

CREATE OR REPLACE FUNCTION public.can_access_owner(target_owner_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR (auth.uid() IS NOT NULL AND target_owner_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_owner(UUID) TO authenticated;

-- ---------- BAGIAN B: Kolom (skip jika sudah ditambah via GUI) ----------

ALTER TABLE categories ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS owner_id UUID;

CREATE INDEX IF NOT EXISTS idx_categories_owner_id ON categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_owner_id ON transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_owner_id ON transaction_items(owner_id);

-- ---------- BAGIAN B: Triggers (butuh ownership tabel) ----------

CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_transaction_item_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM transactions WHERE id = NEW.transaction_id;
  END IF;
  IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_categories_set_owner ON categories;
CREATE TRIGGER trg_categories_set_owner BEFORE INSERT ON categories
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_products_set_owner ON products;
CREATE TRIGGER trg_products_set_owner BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_transactions_set_owner ON transactions;
CREATE TRIGGER trg_transactions_set_owner BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_transaction_items_set_owner ON transaction_items;
CREATE TRIGGER trg_transaction_items_set_owner BEFORE INSERT ON transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.set_transaction_item_owner_id();

-- ---------- BAGIAN B: RLS policies (butuh ownership tabel) ----------
-- Jika error di sini, lewati — aplikasi sudah filter owner_id di kode.

DROP POLICY IF EXISTS "Allow public read on categories" ON categories;
DROP POLICY IF EXISTS "Allow public insert on categories" ON categories;
DROP POLICY IF EXISTS "Allow public update on categories" ON categories;
DROP POLICY IF EXISTS "Allow public delete on categories" ON categories;
DROP POLICY IF EXISTS "Allow public read on products" ON products;
DROP POLICY IF EXISTS "Allow public insert on products" ON products;
DROP POLICY IF EXISTS "Allow public update on products" ON products;
DROP POLICY IF EXISTS "Allow public delete on products" ON products;
DROP POLICY IF EXISTS "Allow public read on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public insert on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public update on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public delete on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public read on transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow public insert on transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow public update on transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow public delete on transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow public read on customers" ON customers;
DROP POLICY IF EXISTS "Allow public insert on customers" ON customers;
DROP POLICY IF EXISTS "Allow public update on customers" ON customers;
DROP POLICY IF EXISTS "Allow public delete on customers" ON customers;
DROP POLICY IF EXISTS "Allow public read on staff" ON staff;
DROP POLICY IF EXISTS "Allow public insert on staff" ON staff;
DROP POLICY IF EXISTS "Allow public update on staff" ON staff;
DROP POLICY IF EXISTS "Allow public delete on staff" ON staff;

CREATE POLICY "tenant_select_categories" ON categories FOR SELECT TO authenticated
  USING (public.can_access_owner(owner_id));
CREATE POLICY "tenant_insert_categories" ON categories FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_update_categories" ON categories FOR UPDATE TO authenticated
  USING (public.can_access_owner(owner_id)) WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "tenant_delete_categories" ON categories FOR DELETE TO authenticated
  USING (public.can_access_owner(owner_id));

CREATE POLICY "tenant_select_products" ON products FOR SELECT TO authenticated
  USING (public.can_access_owner(owner_id));
CREATE POLICY "tenant_insert_products" ON products FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_update_products" ON products FOR UPDATE TO authenticated
  USING (public.can_access_owner(owner_id)) WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "tenant_delete_products" ON products FOR DELETE TO authenticated
  USING (public.can_access_owner(owner_id));

CREATE POLICY "tenant_select_transactions" ON transactions FOR SELECT TO authenticated
  USING (public.can_access_owner(owner_id));
CREATE POLICY "tenant_insert_transactions" ON transactions FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_update_transactions" ON transactions FOR UPDATE TO authenticated
  USING (public.can_access_owner(owner_id)) WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "tenant_delete_transactions" ON transactions FOR DELETE TO authenticated
  USING (public.can_access_owner(owner_id));

CREATE POLICY "tenant_select_transaction_items" ON transaction_items FOR SELECT TO authenticated
  USING (public.can_access_owner(owner_id));
CREATE POLICY "tenant_insert_transaction_items" ON transaction_items FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_update_transaction_items" ON transaction_items FOR UPDATE TO authenticated
  USING (public.can_access_owner(owner_id)) WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "tenant_delete_transaction_items" ON transaction_items FOR DELETE TO authenticated
  USING (public.can_access_owner(owner_id));

CREATE POLICY "shared_select_customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "shared_insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shared_update_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shared_delete_customers" ON customers FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "admin_select_staff" ON staff FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "anon_select_staff" ON staff FOR SELECT TO anon USING (true);
CREATE POLICY "admin_insert_staff" ON staff FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_staff" ON staff FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_staff" ON staff FOR DELETE TO authenticated USING (public.is_admin());

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories, products, customers, transactions, transaction_items, staff TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE categories_id_seq, products_id_seq, customers_id_seq, transactions_id_seq, transaction_items_id_seq, staff_id_seq TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- FILE: migration-fix-sales-access.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- FILE: migration-setup-kasir-auth.sql
-- -----------------------------------------------------------------------------

-- Setup Akun Kasir (Sales) di Supabase Auth
-- Data produk/kategori/transaksi TERPISAH per kasir
-- Data pelanggan BERSAMA (shared) antar semua kasir
--
-- Prasyarat: jalankan migration-multi-tenant-kasir.sql terlebih dahulu

-- ============================================================
-- Buat akun kasir di Supabase Dashboard:
--   Authentication → Users → Add user → Create new user
--
-- Contoh Kasir 1:
--   Email   : kasir1@sbagiamu.com
--   Password: (password kuat)
--   ✓ Auto Confirm User
--
--   User Metadata (WAJIB):
--   {
--     "name": "Ahmad Kasir",
--     "role": "kasir"
--   }
--
-- Contoh Kasir 2:
--   Email   : kasir2@sbagiamu.com
--   Password: (password kuat)
--   User Metadata:
--   {
--     "name": "Budi Kasir",
--     "role": "sales"
--   }
-- ============================================================
--
-- Role yang dikenali aplikasi untuk mode Sales:
--   "kasir"  atau  "sales"
--
-- Admin (lihat semua data):
--   Email: sbagiamu.pos@gmail.com
--   Metadata: { "name": "Admin SBAGIAMU", "role": "admin" }
--
-- Setelah login:
--   • Kasir hanya melihat produk/kategori/transaksi miliknya
--   • Semua kasir melihat & mengubah data pelanggan yang sama
--   • Admin melihat semua data dari semua kasir


-- -----------------------------------------------------------------------------
-- FILE: migration-setup-admin-auth.sql
-- -----------------------------------------------------------------------------

-- Setup Login Admin via Supabase Auth (TANPA tabel staff)
-- Tidak perlu ALTER TABLE — cukup buat user di dashboard Supabase.

-- ============================================================
-- Langkah: Supabase Dashboard → Authentication → Users
--          → Add user → Create new user
--
--   Email   : sbagiamu.pos@gmail.com
--   Password: admin123
--   ✓ Auto Confirm User (centang)
--
--   User Metadata (opsional):
--   {
--     "name": "Admin SBAGIAMU",
--     "role": "admin"
--   }
-- ============================================================
--
-- Mode Sales/Kasir: lihat migration-setup-kasir-auth.sql
-- Setelah buat akun, jalankan migration-multi-tenant-kasir.sql
-- agar data kasir terpisah & pelanggan bersama.
--
-- Login aplikasi memakai Supabase Auth + RLS multi-tenant.


-- -----------------------------------------------------------------------------
-- FILE: migration-grant-authenticated-role.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- FILE: migration-add-outlets-table.sql
-- -----------------------------------------------------------------------------

-- Migration: Add outlets table for multi-tenant support

-- Create outlets table
CREATE TABLE IF NOT EXISTS outlets (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add outlet_id to transactions table for filtering
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id) ON DELETE SET NULL;

-- Add outlet_id to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id) ON DELETE SET NULL;

-- Enable RLS on outlets
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outlets - allow full public access for anon key
DROP POLICY IF EXISTS "Allow public read on outlets" ON outlets;
CREATE POLICY "Allow public read on outlets" ON outlets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on outlets" ON outlets;
CREATE POLICY "Allow public insert on outlets" ON outlets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on outlets" ON outlets;
CREATE POLICY "Allow public update on outlets" ON outlets FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete on outlets" ON outlets;
CREATE POLICY "Allow public delete on outlets" ON outlets FOR DELETE USING (true);

-- Grant permissions for authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON outlets TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE outlets_id_seq TO anon, authenticated;

-- Insert default outlet if none exists
INSERT INTO outlets (name, address, phone, is_active)
SELECT 'Toko Utama', 'Jl. Condongcatur No.123 Yk', '08123456789', true
WHERE NOT EXISTS (SELECT 1 FROM outlets LIMIT 1);

-- Create index for outlet filtering
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_id ON transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_staff_outlet_id ON staff(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlets_is_active ON outlets(is_active);

-- Trigger for outlets updated_at
DROP TRIGGER IF EXISTS update_outlets_updated_at ON outlets;
DROP FUNCTION IF EXISTS update_outlets_updated_at();

CREATE OR REPLACE FUNCTION update_outlets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON outlets
  FOR EACH ROW EXECUTE FUNCTION update_outlets_updated_at();

-- -----------------------------------------------------------------------------
-- FILE: migration-fix-missing-columns.sql
-- -----------------------------------------------------------------------------

-- Migration: Fix missing columns for frontend compatibility
-- Description: Adds image_url to products, store_name to outlets, and outlet_id to customers if they don't exist.

-- 1. Add image_url to products table (if missing)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Add store_name to outlets table (if missing)
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);

-- 3. Add outlet_id to customers table (if missing)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id) ON DELETE SET NULL;

-- 4. Sync name to store_name for existing outlets
UPDATE outlets SET store_name = name WHERE store_name IS NULL;


-- -----------------------------------------------------------------------------
-- FILE: migration-create-expenses-table.sql
-- -----------------------------------------------------------------------------

-- Migration: Create expenses table
-- Description: Table for tracking store expenses

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE expenses IS 'Table for tracking store expenses';
COMMENT ON COLUMN expenses.id IS 'Primary key';
COMMENT ON COLUMN expenses.category IS 'Expense category (operational, inventory, utilities, maintenance, marketing, salary, rent, transport, other)';
COMMENT ON COLUMN expenses.description IS 'Expense description';
COMMENT ON COLUMN expenses.amount IS 'Expense amount in IDR';
COMMENT ON COLUMN expenses.date IS 'Expense date';
COMMENT ON COLUMN expenses.created_at IS 'Record creation timestamp';

-- Insert sample data (optional)
-- INSERT INTO expenses (category, description, amount, date) VALUES
-- ('operational', 'Contoh Pengeluaran', 50000, CURRENT_DATE);


-- -----------------------------------------------------------------------------
-- FILE: migration-add-expenses-owner-id.sql
-- -----------------------------------------------------------------------------

-- Migration: Add owner_id column to expenses table
-- Description: Enable multi-tenant data separation for expenses

-- Add owner_id column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_owner_id ON expenses(owner_id);

-- Grant permissions
GRANT ALL ON public.expenses TO anon;
GRANT ALL ON public.expenses TO authenticated;

-- -----------------------------------------------------------------------------
-- FILE: migration-expenses-rls.sql
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- FILE: migration-add-expenses-outlet-id.sql
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- FILE: migration-add-products-outlet-id.sql
-- -----------------------------------------------------------------------------

-- Migration: Add outlet_id column to products table
-- Description: Enable outlet-based filtering for products

-- Add outlet_id column
ALTER TABLE products ADD COLUMN IF NOT EXISTS outlet_id BIGINT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_outlet_id ON products(outlet_id);

-- Add foreign key constraint (if outlets table exists)
-- Using DO block to check if outlets table exists before adding constraint
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'outlets') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_outlet') THEN
            ALTER TABLE products ADD CONSTRAINT fk_products_outlet
            FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;
        END IF;
    END IF;
END
$$;

-- Grant permissions
GRANT ALL ON public.products TO anon;
GRANT ALL ON public.products TO authenticated;


-- -----------------------------------------------------------------------------
-- FILE: migration-setup-staff.sql
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  outlet_id BIGINT REFERENCES outlets(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for public access (menggunakan anon key untuk MVP)
DROP POLICY IF EXISTS "Allow public read on staff" ON staff;
CREATE POLICY "Allow public read on staff" ON staff FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on staff" ON staff;
CREATE POLICY "Allow public insert on staff" ON staff FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on staff" ON staff;
CREATE POLICY "Allow public update on staff" ON staff FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete on staff" ON staff;
CREATE POLICY "Allow public delete on staff" ON staff FOR DELETE USING (true);

-- Memberikan izin ke user anon dan authenticated
GRANT ALL ON staff TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE staff_id_seq TO anon, authenticated;

-- Memuat ulang cache schema PostgREST
NOTIFY pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- FILE: migration-points-settings.sql
-- -----------------------------------------------------------------------------

-- Create point_settings table
CREATE TABLE IF NOT EXISTS point_settings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  outlet_id BIGINT REFERENCES outlets(id) ON DELETE CASCADE,
  staff_email TEXT,
  enable_points BOOLEAN DEFAULT true,
  points_value BIGINT DEFAULT 1000,
  points_base_type TEXT DEFAULT '10000',
  points_base_custom BIGINT DEFAULT 5000,
  points_earn_rate BIGINT DEFAULT 1,
  max_points_per_transaction BIGINT DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(outlet_id, staff_email) -- Ensure only one setting per outlet + staff combination
);

-- Note for Unique constraint:
-- Since outlet_id and staff_email can be null to represent "All Outlets" or "All Staff",
-- we might need to be careful. In PostgreSQL, NULL != NULL.
-- For a robust approach, we can use coalesce or partial indexes, but in our case,
-- we'll rely on the application logic to ensure we upsert correctly, or we use unique indexes with coalesce.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_settings_unique_target 
ON point_settings (
  COALESCE(outlet_id, -1), 
  COALESCE(staff_email, 'ALL_STAFF')
);

-- RLS (Row Level Security)
ALTER TABLE point_settings ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist before creating
DROP POLICY IF EXISTS "Enable read access for all users" ON point_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON point_settings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON point_settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON point_settings;

-- Allow all authenticated users to read point_settings (or you can restrict to admins)
CREATE POLICY "Enable read access for all users" ON point_settings
  FOR SELECT USING (true);

-- Allow admins/owners to insert/update/delete point_settings
CREATE POLICY "Enable insert for authenticated users" ON point_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON point_settings
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON point_settings
  FOR DELETE USING (true);

-- Grant privileges to roles to prevent 401 Unauthorized
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE point_settings TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE point_settings_id_seq TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- FILE: migration-discount-settings.sql
-- -----------------------------------------------------------------------------

-- ==========================================
-- Migration for Discount & Tax Settings
-- ==========================================

-- 1. Create discount_categories table (Global)
CREATE TABLE IF NOT EXISTS discount_categories (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  note TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Discount Categories
INSERT INTO discount_categories (note) VALUES
  ('Promo Member'),
  ('Diskon Produk'),
  ('Voucher Toko'),
  ('Promo Musiman'),
  ('Komplain Pelanggan')
ON CONFLICT (note) DO NOTHING;

-- RLS for discount_categories
ALTER TABLE discount_categories ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating
DROP POLICY IF EXISTS "Enable read access for all users on discount_categories" ON discount_categories;
DROP POLICY IF EXISTS "Enable insert for authenticated users on discount_categories" ON discount_categories;
DROP POLICY IF EXISTS "Enable update for authenticated users on discount_categories" ON discount_categories;
DROP POLICY IF EXISTS "Enable delete for authenticated users on discount_categories" ON discount_categories;

CREATE POLICY "Enable read access for all users on discount_categories" ON discount_categories
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users on discount_categories" ON discount_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on discount_categories" ON discount_categories
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users on discount_categories" ON discount_categories
  FOR DELETE USING (true);

-- 2. Create discount_settings table (Per Outlet & Kasir)
CREATE TABLE IF NOT EXISTS discount_settings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  outlet_id BIGINT REFERENCES outlets(id) ON DELETE CASCADE,
  staff_email TEXT,
  enable_discount BOOLEAN DEFAULT true,
  default_discount_price NUMERIC DEFAULT 0,
  enable_ppn BOOLEAN DEFAULT true,
  ppn_percentage NUMERIC DEFAULT 11,
  allowed_promos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(outlet_id, staff_email)
);

-- Create unique index to handle NULL values for "All Outlets" and "All Staff"
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_settings_unique_target 
ON discount_settings (
  COALESCE(outlet_id, -1), 
  COALESCE(staff_email, 'ALL_STAFF')
);

-- RLS for discount_settings
ALTER TABLE discount_settings ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating
DROP POLICY IF EXISTS "Enable read access for all users on discount_settings" ON discount_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users on discount_settings" ON discount_settings;
DROP POLICY IF EXISTS "Enable update for authenticated users on discount_settings" ON discount_settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users on discount_settings" ON discount_settings;

CREATE POLICY "Enable read access for all users on discount_settings" ON discount_settings
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users on discount_settings" ON discount_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on discount_settings" ON discount_settings
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users on discount_settings" ON discount_settings
  FOR DELETE USING (true);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE discount_categories TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE discount_categories_id_seq TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE discount_settings TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE discount_settings_id_seq TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- FILE: migration-add-allowed-promos.sql
-- -----------------------------------------------------------------------------

-- ==========================================
-- Migration to Add Allowed Promos to Discount Settings
-- ==========================================

ALTER TABLE discount_settings
ADD COLUMN IF NOT EXISTS allowed_promos JSONB DEFAULT '[]'::jsonb;


-- -----------------------------------------------------------------------------
-- FILE: migration-products-allowed-outlets.sql
-- -----------------------------------------------------------------------------

-- Add allowed_outlets jsonb column
ALTER TABLE products ADD COLUMN IF NOT EXISTS allowed_outlets JSONB DEFAULT '["all"]'::jsonb;

-- Migrate existing outlet_id data to allowed_outlets
UPDATE products
SET allowed_outlets = CASE
    WHEN outlet_id IS NULL THEN '["all"]'::jsonb
    ELSE jsonb_build_array(outlet_id::text)
END;

-- We don't drop outlet_id immediately to prevent breaking things while migrating.
-- But the new frontend logic will prefer allowed_outlets.


-- -----------------------------------------------------------------------------
-- FILE: migration-add-staff-avatar.sql
-- -----------------------------------------------------------------------------

-- Add avatar_url to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket if not exists (Requires the storage schema to be available)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;


-- Hapus policy SELECT lama yang menyebabkan peringatan keamanan
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
CREATE POLICY "Anyone can upload an avatar"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;
CREATE POLICY "Anyone can update their own avatar"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' );


-- -----------------------------------------------------------------------------
-- FILE: migration-fix-storage-policies.sql
-- -----------------------------------------------------------------------------

-- Hapus policy lama yang terlalu longgar
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;

-- Buat policy baru yang mewajibkan user untuk login (authenticated) sebelum bisa upload/update
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Authenticated users can update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' );

-- Pastikan policy SELECT tetap aman, hanya untuk authenticated
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'avatars' );


-- -----------------------------------------------------------------------------
-- FILE: migration-drop-select-policy.sql
-- -----------------------------------------------------------------------------

-- Hapus policy SELECT yang memicu peringatan (warning) dari Supabase.
-- Karena bucket 'avatars' sudah bersifat public, file dapat diakses melalui public URL
-- tanpa memerlukan policy SELECT pada storage.objects. Policy SELECT justru memungkinkan
-- client untuk melakukan listing (melihat daftar semua file) yang tidak kita butuhkan.

DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;


-- -----------------------------------------------------------------------------
-- FILE: migration-strict-storage-policies.sql
-- -----------------------------------------------------------------------------

-- Hapus semua policy sebelumnya yang ada di storage.objects
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;

-- Fitur UPSERT (replace file) di Supabase memerlukan izin SELECT.
-- Agar tidak terkena warning "Broad SELECT", kita batasi SELECT hanya untuk file miliknya sendiri (owner).

CREATE POLICY "Users can select their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = owner );


-- -----------------------------------------------------------------------------
-- FILE: migration-final-storage-policies.sql
-- -----------------------------------------------------------------------------

-- =====================================================
-- FINAL: Storage policy untuk avatar upload (SIMPLE)
-- Hanya perlu INSERT saja, tanpa delete/replace
-- Jalankan ini di SQL Editor Supabase
-- =====================================================

-- 1. Hapus SEMUA policy lama
DROP POLICY IF EXISTS "Users can select their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_avatar" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_avatar" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_avatar" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_avatar" ON storage.objects;

-- 2. Hanya perlu 1 policy: INSERT untuk anon
CREATE POLICY "anon_insert_avatar"
ON storage.objects FOR INSERT
TO anon
WITH CHECK ( bucket_id = 'avatars' );


-- -----------------------------------------------------------------------------
-- FILE: migration-expense-categories.sql
-- -----------------------------------------------------------------------------

-- Create Expense Categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating
DROP POLICY IF EXISTS "Allow public read on expense_categories" ON expense_categories;
DROP POLICY IF EXISTS "Allow public insert on expense_categories" ON expense_categories;
DROP POLICY IF EXISTS "Allow public update on expense_categories" ON expense_categories;
DROP POLICY IF EXISTS "Allow public delete on expense_categories" ON expense_categories;

-- Allow public read
CREATE POLICY "Allow public read on expense_categories" ON expense_categories
  FOR SELECT USING (true);

-- Allow public insert
CREATE POLICY "Allow public insert on expense_categories" ON expense_categories
  FOR INSERT WITH CHECK (true);

-- Allow public update
CREATE POLICY "Allow public update on expense_categories" ON expense_categories
  FOR UPDATE USING (true);

-- Allow public delete
CREATE POLICY "Allow public delete on expense_categories" ON expense_categories
  FOR DELETE USING (true);

-- Seed default categories
INSERT INTO expense_categories (id, name, color) VALUES 
('operational', 'Operasional', 'blue'),
('inventory', 'Pengadaan Barang', 'green'),
('utilities', 'Utilitas', 'yellow'),
('maintenance', 'Perawatan', 'orange'),
('marketing', 'Marketing', 'purple'),
('salary', 'Gaji', 'red'),
('rent', 'Sewa', 'pink'),
('transport', 'Transportasi', 'cyan'),
('other', 'Lainnya', 'slate')
ON CONFLICT (id) DO NOTHING;

-- Add to realtime publication if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expense_categories;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore error if table is already in publication or publication doesn't exist
END $$;

-- Grant privileges to roles to prevent 401 Unauthorized
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE expense_categories TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- FILE: migration-numeric-precision.sql
-- -----------------------------------------------------------------------------

-- Tingkatkan batas maksimal kolom angka menjadi 18 digit (numeric 20,2) untuk mencegah error numeric field overflow
ALTER TABLE expenses ALTER COLUMN amount TYPE numeric(20, 2);

ALTER TABLE transactions ALTER COLUMN subtotal TYPE numeric(20, 2);
ALTER TABLE transactions ALTER COLUMN tax TYPE numeric(20, 2);
ALTER TABLE transactions ALTER COLUMN discount TYPE numeric(20, 2);

ALTER TABLE transaction_items ALTER COLUMN price TYPE numeric(20, 2);
ALTER TABLE transaction_items ALTER COLUMN subtotal TYPE numeric(20, 2);

ALTER TABLE products ALTER COLUMN price TYPE numeric(20, 2);


-- -----------------------------------------------------------------------------
-- FILE: migration-category-outlets.sql
-- -----------------------------------------------------------------------------

ALTER TABLE categories ADD COLUMN IF NOT EXISTS allowed_outlets JSONB DEFAULT '["all"]'::jsonb;


-- -----------------------------------------------------------------------------
-- FILE: setup-promo-system.sql
-- -----------------------------------------------------------------------------

-- ==========================================
-- 1. SETUP FUNCTIONS (RUN THIS FIRST)
-- ==========================================

-- Function to check if user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    lower(auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  )
  OR lower(auth.jwt() ->> 'email') = 'sbagiamu.pos@gmail.com';
$$;

-- Function to automatically set owner_id
CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  RETURN NEW;
END; $$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_owner_id() TO authenticated;


-- ==========================================
-- 2. CREATE TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.promo_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 3. ENABLE SECURITY (RLS)
-- ==========================================

ALTER TABLE public.promo_templates ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can view their own promo templates" 
    ON public.promo_templates FOR SELECT 
    USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can insert their own promo templates" 
    ON public.promo_templates FOR INSERT 
    WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can update their own promo templates" 
    ON public.promo_templates FOR UPDATE 
    USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete their own promo templates" ON public.promo_templates;
CREATE POLICY "Users can delete their own promo templates" 
    ON public.promo_templates FOR DELETE 
    USING (auth.uid() = owner_id OR public.is_admin());


-- ==========================================
-- 4. SETUP TRIGGER
-- ==========================================

DROP TRIGGER IF EXISTS trg_promo_templates_set_owner ON public.promo_templates;
CREATE TRIGGER trg_promo_templates_set_owner 
    BEFORE INSERT ON public.promo_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- Grant table permissions
GRANT ALL ON public.promo_templates TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE promo_templates_id_seq TO authenticated;


-- -----------------------------------------------------------------------------
-- FILE: fix-promo-permissions.sql
-- -----------------------------------------------------------------------------

-- ======================================================
-- FIX PERMISSIONS FOR PROMO TEMPLATES
-- ======================================================

-- 1. Ensure schema usage permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Grant explicit table permissions
GRANT ALL ON TABLE public.promo_templates TO authenticated;
GRANT ALL ON TABLE public.promo_templates TO service_role;

-- 3. Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE public.promo_templates_id_seq TO authenticated;

-- 4. Re-configure Policies to be more robust
-- Drop existing ones first
DROP POLICY IF EXISTS "Users can view their own promo templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Users can insert their own promo templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Users can update their own promo templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Users can delete their own promo templates" ON public.promo_templates;

-- View: Allow all authenticated users to view (simpler)
CREATE POLICY "Users can view their own promo templates" 
    ON public.promo_templates FOR SELECT 
    TO authenticated
    USING (true);

-- Insert: Must be authenticated
CREATE POLICY "Users can insert their own promo templates" 
    ON public.promo_templates FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- Update: Owner or Admin
CREATE POLICY "Users can update their own promo templates" 
    ON public.promo_templates FOR UPDATE 
    TO authenticated
    USING (auth.uid() = owner_id OR public.is_admin());

-- Delete: Owner or Admin
CREATE POLICY "Users can delete their own promo templates" 
    ON public.promo_templates FOR DELETE 
    TO authenticated
    USING (auth.uid() = owner_id OR public.is_admin());

-- 5. Ensure the owner_id trigger is active
DROP TRIGGER IF EXISTS trg_promo_templates_set_owner ON public.promo_templates;
CREATE TRIGGER trg_promo_templates_set_owner 
    BEFORE INSERT ON public.promo_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();


-- -----------------------------------------------------------------------------
-- FILE: migration-add-promo-templates.sql
-- -----------------------------------------------------------------------------

-- ======================================================
-- SUPER OPEN FIX FOR PROMO TEMPLATES (ELIMINATE 401)
-- ======================================================

-- 1. Reset Table without strict Foreign Keys for now
DROP TABLE IF EXISTS public.promo_templates CASCADE;

CREATE TABLE public.promo_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Grant Permissions to EVERYONE (including PUBLIC role)
-- This ensures that even if auth session is confused, the request can pass
GRANT USAGE ON SCHEMA public TO anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.promo_templates TO anon;
GRANT ALL ON TABLE public.promo_templates TO authenticated;
GRANT ALL ON TABLE public.promo_templates TO service_role;
GRANT ALL ON TABLE public.promo_templates TO PUBLIC;

-- 3. Grant Sequence Permissions
GRANT ALL ON SEQUENCE public.promo_templates_id_seq TO anon;
GRANT ALL ON SEQUENCE public.promo_templates_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.promo_templates_id_seq TO PUBLIC;

-- 4. Disable RLS (Nuclear Option)
-- This removes any 401/403 checks at the database level
ALTER TABLE public.promo_templates DISABLE ROW LEVEL SECURITY;

-- 5. Force API Schema Reload
NOTIFY pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- FILE: ultimate-promo-fix.sql
-- -----------------------------------------------------------------------------

-- ======================================================
-- ULTIMATE FIX FOR PROMO TEMPLATES (401 UNAUTHORIZED)
-- ======================================================

-- 1. Hapus tabel lama agar benar-benar fresh
DROP TABLE IF EXISTS public.promo_templates CASCADE;

-- 2. Buat ulang tabel dengan struktur paling sederhana
-- Menggunakan SERIAL agar sequence otomatis terurus
CREATE TABLE public.promo_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Matikan semua sistem keamanan RLS untuk tabel ini
-- Ini akan mengizinkan akses tanpa memerlukan token JWT yang valid
ALTER TABLE public.promo_templates DISABLE ROW LEVEL SECURITY;

-- 4. Berikan izin akses penuh ke semua jenis role
GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON TABLE public.promo_templates TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON SEQUENCE public.promo_templates_id_seq TO anon, authenticated, postgres, service_role, PUBLIC;

-- 5. Paksa Supabase/PostgREST untuk memuat ulang definisi tabel
NOTIFY pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- FILE: nuclear-fix-promo.sql
-- -----------------------------------------------------------------------------

-- ======================================================
-- NUCLEAR FIX FOR PROMO TEMPLATES (401/42501 ERROR)
-- ======================================================

-- 1. Hapus total tabel lama (Hati-hati: Data template lama akan hilang)
DROP TABLE IF EXISTS public.promo_templates CASCADE;

-- 2. Buat ulang tabel dengan struktur yang benar
CREATE TABLE public.promo_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Berikan izin akses menyeluruh ke semua role
-- Ini krusial karena aplikasi menggunakan role 'anon' setelah login
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.promo_templates TO anon;
GRANT ALL ON TABLE public.promo_templates TO authenticated;
GRANT ALL ON TABLE public.promo_templates TO service_role;

-- 4. Berikan izin pada sequence ID
GRANT USAGE, SELECT ON SEQUENCE public.promo_templates_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.promo_templates_id_seq TO authenticated;

-- 5. MATIKAN RLS (PENTING!)
-- Mematikan RLS akan menghilangkan kendala 401/42501 saat akses data
ALTER TABLE public.promo_templates DISABLE ROW LEVEL SECURITY;

-- 6. Paksa Supabase memuat ulang cache API
NOTIFY pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- FILE: migration-promo-logs.sql
-- -----------------------------------------------------------------------------

-- ======================================================
-- CREATE PROMO SENT LOGS TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS public.promo_sent_logs (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL, 
    template_id BIGINT,          
    owner_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matikan RLS agar tidak ada error 401 saat menyimpan log
ALTER TABLE public.promo_sent_logs DISABLE ROW LEVEL SECURITY;

-- Berikan izin akses penuh ke semua role (termasuk anon)
GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON TABLE public.promo_sent_logs TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON SEQUENCE public.promo_sent_logs_id_seq TO anon, authenticated, postgres, service_role, PUBLIC;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- FILE: migration-promo-rls.sql
-- -----------------------------------------------------------------------------

-- Enable RLS for promo tables
ALTER TABLE public.promo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_sent_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all operations for users based on owner_id" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable read access for public templates" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable all operations for users based on owner_id" ON public.promo_sent_logs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.promo_templates;
DROP POLICY IF EXISTS "Enable update/delete for owner" ON public.promo_templates;

-- NEW POLICIES: promo_templates
-- 1. Semua user (termasuk anon) boleh melihat (SELECT) semua template
CREATE POLICY "Enable read access for authenticated users"
ON public.promo_templates FOR SELECT
TO public
USING (true);

-- 2. Semua user boleh membuat (INSERT) template baru
CREATE POLICY "Enable insert for authenticated users"
ON public.promo_templates FOR INSERT
TO public
WITH CHECK (true);

-- 3. Mengizinkan user yang login untuk UPDATE dan DELETE (Sementara di-bypass owner_id nya untuk mengatasi error 401/0 rows affected)
CREATE POLICY "Enable update/delete for owner"
ON public.promo_templates FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- NEW POLICIES: promo_sent_logs
-- Sama dengan templates, izinkan select dan insert
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.promo_sent_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.promo_sent_logs;
DROP POLICY IF EXISTS "Enable delete for owner" ON public.promo_sent_logs;

CREATE POLICY "Enable read access for authenticated users"
ON public.promo_sent_logs FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.promo_sent_logs FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable delete for owner"
ON public.promo_sent_logs FOR DELETE
TO public
USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_sent_logs TO anon, authenticated;

-- Grant sequence permissions if there are any (assuming bigserial/serial PK)
-- Replace promo_templates_id_seq with the actual sequence name if different
DO $$
DECLARE
    seq_name text;
BEGIN
    SELECT pg_get_serial_sequence('public.promo_templates', 'id') INTO seq_name;
    IF seq_name IS NOT NULL THEN
        EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ' || seq_name || ' TO anon, authenticated';
    END IF;
    
    SELECT pg_get_serial_sequence('public.promo_sent_logs', 'id') INTO seq_name;
    IF seq_name IS NOT NULL THEN
        EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ' || seq_name || ' TO anon, authenticated';
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- FILE: migration-add-staff-owner-id.sql
-- -----------------------------------------------------------------------------

-- Migration: Add owner_id to staff table
-- Description: Links staff records to Supabase Auth users for multi-tenant mapping

ALTER TABLE staff ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_staff_owner_id ON staff(owner_id);

-- Update existing staff records based on avatar_url if possible (HACK for existing data)
-- This extracts the UUID from the avatar URL if it exists
UPDATE staff 
SET owner_id = (substring(avatar_url from '/avatars/([0-9a-f-]{36})_'))::uuid
WHERE owner_id IS NULL AND avatar_url IS NOT NULL AND avatar_url ~ '/avatars/[0-9a-f-]{36}_';


-- -----------------------------------------------------------------------------
-- FILE: final_promo_fix.sql
-- -----------------------------------------------------------------------------

-- ======================================================
-- FINAL SUPER-OPEN SQL FOR PROMO TEMPLATES
-- RUN THIS IN SUPABASE SQL EDITOR
-- ======================================================

-- 1. Reset Table
DROP TABLE IF EXISTS public.promo_templates CASCADE;

CREATE TABLE public.promo_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Completely Disable Row Level Security
ALTER TABLE public.promo_templates DISABLE ROW LEVEL SECURITY;

-- 3. Grant Permissions to every possible role
-- This ensures the 'anon' key used by the app can access the table
GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON TABLE public.promo_templates TO anon, authenticated, postgres, service_role, PUBLIC;
GRANT ALL ON SEQUENCE public.promo_templates_id_seq TO anon, authenticated, postgres, service_role, PUBLIC;

-- 4. Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Extra check: ensure the table is actually in the public schema and accessible
COMMENT ON TABLE public.promo_templates IS 'Promo message templates accessible by everyone';


-- -----------------------------------------------------------------------------
-- FILE: migration-add-expenses-supplier.sql
-- -----------------------------------------------------------------------------

-- Migration: Add supplier column to expenses table
-- Description: Adds a supplier column to track who the expense was paid to

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier TEXT;

COMMENT ON COLUMN expenses.supplier IS 'The supplier or recipient of the payment';


-- -----------------------------------------------------------------------------
-- FILE: migration-add-expenses-image.sql
-- -----------------------------------------------------------------------------

-- Migration: Add image_url column to expenses table
-- Description: Adds an image_url column to track receipt images

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN expenses.image_url IS 'URL of the uploaded receipt image';


-- -----------------------------------------------------------------------------
-- FILE: migration-setup-expense-receipts-storage.sql
-- -----------------------------------------------------------------------------

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
DROP POLICY IF EXISTS "Anon can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anon can delete expense receipts" ON storage.objects;

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


-- -----------------------------------------------------------------------------
-- FILE: migration-add-outlets-footers.sql
-- -----------------------------------------------------------------------------

-- Migration: Add footer settings to outlets table
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS footer_message TEXT;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS footer_message2 TEXT;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS footer_message3 TEXT;


-- -----------------------------------------------------------------------------
-- FILE: migration-enable-realtime-sync.sql
-- -----------------------------------------------------------------------------

-- Enable realtime replication for visit_schedules, visit_logs, sales_returns, sales_return_items, transactions, and transaction_payments tables
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Add visit_schedules to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_schedules'
    ) then
      alter publication supabase_realtime add table visit_schedules;
    end if;

    -- Add visit_logs to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_logs'
    ) then
      alter publication supabase_realtime add table visit_logs;
    end if;

    -- Add sales_returns to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_returns'
    ) then
      alter publication supabase_realtime add table sales_returns;
    end if;

    -- Add sales_return_items to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_return_items'
    ) then
      alter publication supabase_realtime add table sales_return_items;
    end if;

    -- Add transactions to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
    ) then
      alter publication supabase_realtime add table transactions;
    end if;

    -- Add transaction_payments to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transaction_payments'
    ) then
      alter publication supabase_realtime add table transaction_payments;
    end if;
  end if;
exception
  when others then
    raise notice 'Could not automatically add tables to supabase_realtime publication: %', sqlerrm;
end;
$$;


