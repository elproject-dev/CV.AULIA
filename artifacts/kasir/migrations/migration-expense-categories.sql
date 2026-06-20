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
