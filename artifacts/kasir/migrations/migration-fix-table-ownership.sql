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
