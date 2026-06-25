-- Enable realtime replication for visit_schedules, visit_logs, sales_returns, sales_return_items, transactions, and transaction_payments tables
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Add visit_schedules to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_schedules'
    ) then
      alter publication supabase_realtime add table visit_schedules;
    end if;

    -- Add visit_logs to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_logs'
    ) then
      alter publication supabase_realtime add table visit_logs;
    end if;

    -- Add sales_returns to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_returns'
    ) then
      alter publication supabase_realtime add table sales_returns;
    end if;

    -- Add sales_return_items to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_return_items'
    ) then
      alter publication supabase_realtime add table sales_return_items;
    end if;

    -- Add transactions to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
    ) then
      alter publication supabase_realtime add table transactions;
    end if;

    -- Add transaction_payments to publication
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transaction_payments'
    ) then
      alter publication supabase_realtime add table transaction_payments;
    end if;
  end if;
exception
  when others then
    raise notice 'Could not automatically add tables to supabase_realtime publication: %', sqlerrm;
end;
$$;
