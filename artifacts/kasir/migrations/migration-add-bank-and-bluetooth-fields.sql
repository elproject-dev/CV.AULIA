-- Migration to add bank account info and bluetooth print store name to outlets table
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS bank_account VARCHAR(255);
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS bluetooth_store_name VARCHAR(255);
