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
