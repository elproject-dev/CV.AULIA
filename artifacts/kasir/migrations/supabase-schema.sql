-- Enable UUID extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



-- Categories table

DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS outlets CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS point_settings CASCADE;
DROP TABLE IF EXISTS discount_settings CASCADE;
DROP TABLE IF EXISTS discount_categories CASCADE;
DROP TABLE IF EXISTS promo_templates CASCADE;
DROP TABLE IF EXISTS promo_sent_logs CASCADE;



CREATE TABLE categories (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Products table

CREATE TABLE products (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  price DECIMAL(12, 2) NOT NULL,

  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,

  imageUrl TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Customers table

CREATE TABLE customers (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  email VARCHAR(255),

  phone VARCHAR(50),

  membership_type VARCHAR(50) DEFAULT 'regular',

  points INTEGER DEFAULT 0,

  total_spent DECIMAL(12, 2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Staff table

CREATE TABLE staff (

  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  email VARCHAR(255) NOT NULL,

  phone VARCHAR(50),

  role VARCHAR(50) NOT NULL,

  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Transactions table

CREATE TABLE transactions (

  id BIGSERIAL PRIMARY KEY,

  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,

  cashier_name VARCHAR(255),

  payment_method VARCHAR(50) NOT NULL,

  subtotal DECIMAL(12, 2) NOT NULL,

  tax DECIMAL(12, 2) NOT NULL,

  discount DECIMAL(12, 2) DEFAULT 0,

  discount_note VARCHAR(255),

  customer_type VARCHAR(50) DEFAULT 'non_member',

  amount_paid DECIMAL(12, 2) NOT NULL,

  change DECIMAL(12, 2) DEFAULT 0,

  points_used INTEGER DEFAULT 0,

  points_earned INTEGER DEFAULT 0,

  status VARCHAR(50) DEFAULT 'completed',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Transaction Items table

CREATE TABLE transaction_items (

  id BIGSERIAL PRIMARY KEY,

  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  product_name VARCHAR(255) NOT NULL,

  quantity INTEGER NOT NULL,

  price DECIMAL(12, 2) NOT NULL,

  subtotal DECIMAL(12, 2) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Enable Row Level Security

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;



-- RLS Policies for public access (using anon key)

DROP POLICY IF EXISTS "Allow public read on categories" ON categories;

CREATE POLICY "Allow public read on categories" ON categories

  FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public insert on categories" ON categories;

CREATE POLICY "Allow public insert on categories" ON categories

  FOR INSERT WITH CHECK (true);



DROP POLICY IF EXISTS "Allow public update on categories" ON categories;

CREATE POLICY "Allow public update on categories" ON categories

  FOR UPDATE USING (true);



DROP POLICY IF EXISTS "Allow public delete on categories" ON categories;

CREATE POLICY "Allow public delete on categories" ON categories

  FOR DELETE USING (true);



DROP POLICY IF EXISTS "Allow public read on products" ON products;

CREATE POLICY "Allow public read on products" ON products

  FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public insert on products" ON products;

CREATE POLICY "Allow public insert on products" ON products

  FOR INSERT WITH CHECK (true);



DROP POLICY IF EXISTS "Allow public update on products" ON products;

CREATE POLICY "Allow public update on products" ON products

  FOR UPDATE USING (true);



DROP POLICY IF EXISTS "Allow public delete on products" ON products;

CREATE POLICY "Allow public delete on products" ON products

  FOR DELETE USING (true);



DROP POLICY IF EXISTS "Allow public read on customers" ON customers;

CREATE POLICY "Allow public read on customers" ON customers

  FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public insert on customers" ON customers;

CREATE POLICY "Allow public insert on customers" ON customers

  FOR INSERT WITH CHECK (true);



DROP POLICY IF EXISTS "Allow public update on customers" ON customers;

CREATE POLICY "Allow public update on customers" ON customers

  FOR UPDATE USING (true);



DROP POLICY IF EXISTS "Allow public delete on customers" ON customers;

CREATE POLICY "Allow public delete on customers" ON customers

  FOR DELETE USING (true);



DROP POLICY IF EXISTS "Allow public read on staff" ON staff;

CREATE POLICY "Allow public read on staff" ON staff

  FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public insert on staff" ON staff;

CREATE POLICY "Allow public insert on staff" ON staff

  FOR INSERT WITH CHECK (true);



DROP POLICY IF EXISTS "Allow public update on staff" ON staff;

CREATE POLICY "Allow public update on staff" ON staff

  FOR UPDATE USING (true);



DROP POLICY IF EXISTS "Allow public delete on staff" ON staff;

CREATE POLICY "Allow public delete on staff" ON staff

  FOR DELETE USING (true);



DROP POLICY IF EXISTS "Allow public read on transactions" ON transactions;

CREATE POLICY "Allow public read on transactions" ON transactions

  FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public insert on transactions" ON transactions;

CREATE POLICY "Allow public insert on transactions" ON transactions

  FOR INSERT WITH CHECK (true);



DROP POLICY IF EXISTS "Allow public delete on transactions" ON transactions;

CREATE POLICY "Allow public delete on transactions" ON transactions

  FOR DELETE USING (true);



DROP POLICY IF EXISTS "Allow public read on transaction_items" ON transaction_items;

CREATE POLICY "Allow public read on transaction_items" ON transaction_items

  FOR SELECT USING (true);



DROP POLICY IF EXISTS "Allow public insert on transaction_items" ON transaction_items;

CREATE POLICY "Allow public insert on transaction_items" ON transaction_items

  FOR INSERT WITH CHECK (true);



DROP POLICY IF EXISTS "Allow public delete on transaction_items" ON transaction_items;

CREATE POLICY "Allow public delete on transaction_items" ON transaction_items

  FOR DELETE USING (true);



-- Create indexes for better performance

CREATE INDEX idx_products_category_id ON products(category_id);

CREATE INDEX idx_products_is_active ON products(is_active);

CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);

CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);

CREATE INDEX idx_transaction_items_product_id ON transaction_items(product_id);



-- Insert initial categories

INSERT INTO categories (name) VALUES 

('Food'),

('Drink'),

('Snack');



-- Insert initial products

INSERT INTO products (name, price, category_id, imageUrl, is_active) VALUES 

('Product A', 50000, 1, '', true),

('Product B', 75000, 2, '', true),

('Product C', 30000, 1, '', true);



-- Insert initial customers

INSERT INTO customers (name, email, phone, membership_type, points) VALUES 

('John Doe', 'john@example.com', '08123456789', 'regular', 100),

('Jane Smith', 'jane@example.com', '08198765432', 'gold', 500),

('Bob Johnson', 'bob@example.com', '08156789012', 'regular', 50);



-- Insert initial staff

INSERT INTO staff (name, email, phone, role, status) VALUES 

('Ahmad Kasir', 'ahmad@sbagiamu.com', '08123456789', 'kasir', 'active'),

('Budi Supervisor', 'budi@sbagiamu.com', '08156789012', 'supervisor', 'active'),

('Super Admin', 'sbagiamu.pos@gmail.com', '08123456789', 'admin', 'active');



-- Function to update updated_at timestamp

CREATE OR REPLACE FUNCTION update_updated_at_column()

RETURNS TRIGGER AS $$

BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;



-- Triggers for updated_at

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff

  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

