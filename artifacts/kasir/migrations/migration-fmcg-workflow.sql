-- Migration: FMCG Distribution Workflow
-- Adds stock tracking, transfer/loading sessions, and links transactions to loading sessions.

-- 1. Add stock_quantity to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- 2. Create loading_sessions table
CREATE TABLE IF NOT EXISTS loading_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_id BIGINT REFERENCES staff(id) ON DELETE SET NULL,
  date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'closed'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create loading_items table
CREATE TABLE IF NOT EXISTS loading_items (
  id BIGSERIAL PRIMARY KEY,
  loading_session_id UUID REFERENCES loading_sessions(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  quantity_loaded INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL, -- Positive for in, Negative for out
  type VARCHAR(50) NOT NULL, -- 'restock', 'transfer_to_sales', 'return_from_sales', 'adjustment', 'sale'
  reference_id UUID, -- Links to loading_session_id or transaction_id (we use UUID for reference flexibly, or we can use TEXT)
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Change reference_id to TEXT because transaction_id is BIGINT, loading_session_id is UUID
ALTER TABLE stock_movements ALTER COLUMN reference_id TYPE TEXT;

-- 5. Add loading_session_id to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loading_session_id UUID REFERENCES loading_sessions(id) ON DELETE SET NULL;

-- 6. Enable RLS
ALTER TABLE loading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (Allow anon for simple kasir login mechanism as per previous setup)
DROP POLICY IF EXISTS "Allow public read on loading_sessions" ON loading_sessions;
CREATE POLICY "Allow public read on loading_sessions" ON loading_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on loading_sessions" ON loading_sessions;
CREATE POLICY "Allow public insert on loading_sessions" ON loading_sessions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on loading_sessions" ON loading_sessions;
CREATE POLICY "Allow public update on loading_sessions" ON loading_sessions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete on loading_sessions" ON loading_sessions;
CREATE POLICY "Allow public delete on loading_sessions" ON loading_sessions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on loading_items" ON loading_items;
CREATE POLICY "Allow public read on loading_items" ON loading_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on loading_items" ON loading_items;
CREATE POLICY "Allow public insert on loading_items" ON loading_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on loading_items" ON loading_items;
CREATE POLICY "Allow public update on loading_items" ON loading_items FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete on loading_items" ON loading_items;
CREATE POLICY "Allow public delete on loading_items" ON loading_items FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read on stock_movements" ON stock_movements;
CREATE POLICY "Allow public read on stock_movements" ON stock_movements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on stock_movements" ON stock_movements;
CREATE POLICY "Allow public insert on stock_movements" ON stock_movements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update on stock_movements" ON stock_movements;
CREATE POLICY "Allow public update on stock_movements" ON stock_movements FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete on stock_movements" ON stock_movements;
CREATE POLICY "Allow public delete on stock_movements" ON stock_movements FOR DELETE USING (true);

-- 8. Triggers for updated_at
DROP TRIGGER IF EXISTS update_loading_sessions_updated_at ON loading_sessions;
CREATE TRIGGER update_loading_sessions_updated_at BEFORE UPDATE ON loading_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loading_items_updated_at ON loading_items;
CREATE TRIGGER update_loading_items_updated_at BEFORE UPDATE ON loading_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
