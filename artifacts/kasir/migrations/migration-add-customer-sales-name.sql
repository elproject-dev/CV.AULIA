-- Add sales_name to customers table to track who input the data
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sales_name VARCHAR(255);
