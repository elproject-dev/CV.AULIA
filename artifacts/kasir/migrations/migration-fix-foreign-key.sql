
-- Migration untuk memperbaiki foreign key constraint di transaction_items
-- Menambahkan ON DELETE CASCADE pada product_id untuk menghindari constraint violation

-- Drop existing foreign key constraint
ALTER TABLE transaction_items 
DROP CONSTRAINT IF EXISTS transaction_items_product_id_fkey;

-- Add new foreign key constraint with ON DELETE CASCADE
ALTER TABLE transaction_items 
ADD CONSTRAINT transaction_items_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE CASCADE;

-- Catatan: ON DELETE CASCADE berarti jika produk dihapus, 
-- semua transaction_items yang terkait juga akan dihapus secara otomatis
-- Ini mencegah error foreign key violation saat menghapus produk
