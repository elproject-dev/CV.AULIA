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
