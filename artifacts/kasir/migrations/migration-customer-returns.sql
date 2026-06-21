-- Migration: Customer Returns
-- Adds sales_returns and sales_return_items to track customer product returns

-- Create sales_returns table
CREATE TABLE IF NOT EXISTS sales_returns (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  cashier_name VARCHAR(255),
  total_refund DECIMAL(12, 2) NOT NULL DEFAULT 0,
  reason VARCHAR(255) NOT NULL, -- e.g., 'Barang Rusak', 'Kadaluarsa', 'Salah Produk', 'Lainnya'
  notes TEXT,
  status VARCHAR(50) DEFAULT 'completed', -- 'completed', 'pending'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sales_return_items table
CREATE TABLE IF NOT EXISTS sales_return_items (
  id BIGSERIAL PRIMARY KEY,
  return_id BIGINT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  transaction_item_id BIGINT NOT NULL REFERENCES transaction_items(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  unit_name VARCHAR(50),
  quantity INTEGER NOT NULL,
  refund_price DECIMAL(12, 2) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;

-- Policies for sales_returns
DROP POLICY IF EXISTS "Allow public read on sales_returns" ON sales_returns;
CREATE POLICY "Allow public read on sales_returns" ON sales_returns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on sales_returns" ON sales_returns;
CREATE POLICY "Allow public insert on sales_returns" ON sales_returns FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on sales_returns" ON sales_returns;
CREATE POLICY "Allow public update on sales_returns" ON sales_returns FOR UPDATE USING (true);

-- Policies for sales_return_items
DROP POLICY IF EXISTS "Allow public read on sales_return_items" ON sales_return_items;
CREATE POLICY "Allow public read on sales_return_items" ON sales_return_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on sales_return_items" ON sales_return_items;
CREATE POLICY "Allow public insert on sales_return_items" ON sales_return_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on sales_return_items" ON sales_return_items;
CREATE POLICY "Allow public update on sales_return_items" ON sales_return_items FOR UPDATE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_sales_returns_updated_at BEFORE UPDATE ON sales_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
