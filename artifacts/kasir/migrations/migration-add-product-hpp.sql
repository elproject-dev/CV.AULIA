-- Migration: Add HPP (Harga Pokok Penjualan) column to products table
-- Run this in Supabase SQL Editor

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hpp numeric(15, 2) DEFAULT NULL;

COMMENT ON COLUMN products.hpp IS 'Harga Pokok Penjualan (modal/biaya per unit pcs)';
