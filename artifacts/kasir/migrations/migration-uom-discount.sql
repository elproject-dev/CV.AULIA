-- Migration: UOM Discounts
-- Adds discount columns to product_uoms table

ALTER TABLE product_uoms ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) DEFAULT 'none'; 
-- 'none' | 'amount' | 'percent'
ALTER TABLE product_uoms ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) DEFAULT 0;
-- Nilai diskon (Rp atau %)
ALTER TABLE product_uoms ADD COLUMN IF NOT EXISTS label VARCHAR(100);
-- Label keterangan diskon, e.g. "Beli dus hemat 5%!"
ALTER TABLE product_uoms ADD COLUMN IF NOT EXISTS min_qty INTEGER DEFAULT 1;
-- Minimal kuantitas pembelian agar diskon berlaku
