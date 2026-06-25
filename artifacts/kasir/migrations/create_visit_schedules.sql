-- ================================================================
-- Migration: Jadwal Kunjungan Sales
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- ================================================================

-- Tabel utama jadwal kunjungan
CREATE TABLE IF NOT EXISTS visit_schedules (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  sales_name TEXT NOT NULL,
  staff_id INTEGER,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  -- 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 7=Minggu
  visit_time TEXT,             -- Format HH:MM (optional)
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id TEXT                -- Multi-tenant filter
);

-- Tabel log kunjungan (GPS check-in)
CREATE TABLE IF NOT EXISTS visit_logs (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES visit_schedules(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  sales_name TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_address TEXT,
  notes TEXT,
  owner_id TEXT
);

-- Indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_visit_schedules_day ON visit_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_visit_schedules_owner ON visit_schedules(owner_id);
CREATE INDEX IF NOT EXISTS idx_visit_schedules_customer ON visit_schedules(customer_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_schedule ON visit_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_owner ON visit_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_visited_at ON visit_logs(visited_at);

-- RLS Policies (Row Level Security) - sesuai pola yang sudah ada di proyek
ALTER TABLE visit_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read/write dengan anon key (sesuai arsitektur proyek)
CREATE POLICY "Public access visit_schedules" ON visit_schedules
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access visit_logs" ON visit_logs
  FOR ALL USING (true) WITH CHECK (true);
