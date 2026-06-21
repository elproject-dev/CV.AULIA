-- Enable delete operations on stock_movements for authenticated users
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.stock_movements;
CREATE POLICY "Enable delete for authenticated users" ON public.stock_movements
    FOR DELETE USING (auth.uid() IS NOT NULL);
