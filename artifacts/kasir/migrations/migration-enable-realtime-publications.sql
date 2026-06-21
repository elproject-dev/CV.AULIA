-- Enable realtime for products, categories, and product_uoms tables in Supabase Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Check if products is already in the publication before adding
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
    ) then
      alter publication supabase_realtime add table products;
    end if;

    -- Check if categories is already in the publication before adding
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories'
    ) then
      alter publication supabase_realtime add table categories;
    end if;

    -- Check if product_uoms is already in the publication before adding
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_uoms'
    ) then
      alter publication supabase_realtime add table product_uoms;
    end if;
  end if;
exception
  when others then
    raise notice 'Could not automatically add tables to supabase_realtime publication: %', sqlerrm;
end;
$$;
