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