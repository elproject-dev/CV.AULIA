-- Migration: Multi Unit of Measure (Multi UOM)
-- Adds product_uoms table for managing multiple units per product (dus, box, pack, pcs)
-- Stock is always stored in pcs (smallest unit), UOM defines conversion factors.

-- 1. Create product_uoms table
CREATE TABLE IF NOT EXISTS product_uoms (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_name VARCHAR(50) NOT NULL,        -- 'pcs', 'pack', 'box', 'dus', etc.
  conversion_factor INTEGER NOT NULL DEFAULT 1, -- How many pcs in 1 of this unit
  price DECIMAL(12, 2),                   -- Optional selling price per unit
  barcode VARCHAR(100),                   -- Optional barcode per unit
  sort_order INTEGER DEFAULT 0,           -- Display order (smaller = first)
  is_default BOOLEAN DEFAULT false,       -- Default unit shown in POS
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, unit_name)
);

-- 2. Add UOM reference columns to transaction_items
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS unit_name VARCHAR(50) DEFAULT 'pcs';
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS unit_qty INTEGER;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS conversion_factor INTEGER DEFAULT 1;

-- 3. Add UOM reference columns to stock_movements
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_name VARCHAR(50) DEFAULT 'pcs';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_qty INTEGER;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS conversion_factor INTEGER DEFAULT 1;

-- 4. Enable RLS
ALTER TABLE product_uoms ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (public access like other shared tables)
DROP POLICY IF EXISTS "Allow public read on product_uoms" ON product_uoms;
CREATE POLICY "Allow public read on product_uoms" ON product_uoms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on product_uoms" ON product_uoms;
CREATE POLICY "Allow public insert on product_uoms" ON product_uoms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on product_uoms" ON product_uoms;
CREATE POLICY "Allow public update on product_uoms" ON product_uoms FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete on product_uoms" ON product_uoms;
CREATE POLICY "Allow public delete on product_uoms" ON product_uoms FOR DELETE USING (true);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_product_uoms_product_id ON product_uoms(product_id);
CREATE INDEX IF NOT EXISTS idx_product_uoms_unit_name ON product_uoms(unit_name);

-- 7. Trigger for updated_at
DROP TRIGGER IF EXISTS update_product_uoms_updated_at ON product_uoms;
CREATE TRIGGER update_product_uoms_updated_at BEFORE UPDATE ON product_uoms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
