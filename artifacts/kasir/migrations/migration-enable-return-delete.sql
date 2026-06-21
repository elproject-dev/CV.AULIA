-- Enable DELETE policy for sales_returns
DROP POLICY IF EXISTS "Allow public delete on sales_returns" ON sales_returns;
CREATE POLICY "Allow public delete on sales_returns" ON sales_returns FOR DELETE USING (true);

-- Enable DELETE policy for sales_return_items
DROP POLICY IF EXISTS "Allow public delete on sales_return_items" ON sales_return_items;
CREATE POLICY "Allow public delete on sales_return_items" ON sales_return_items FOR DELETE USING (true);
