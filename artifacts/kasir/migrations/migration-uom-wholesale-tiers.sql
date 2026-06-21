-- Migration: Support UOM Wholesale / Discount Tiers
-- Description: Drops the UNIQUE constraint on (product_id, unit_name) and replaces it with a UNIQUE constraint on (product_id, unit_name, min_qty)
-- This allows defining multiple wholesale tiers (e.g. 1 box with Rp 0 discount, 5 box with Rp 10.000 discount)

do $$
begin
  -- 1. Drop the old UNIQUE constraint if it exists
  alter table product_uoms drop constraint if exists product_uoms_product_id_unit_name_key;
  
  -- 2. Add the new UNIQUE constraint (product_id, unit_name, min_qty)
  alter table product_uoms add constraint product_uoms_product_id_unit_name_min_qty_key unique (product_id, unit_name, min_qty);
exception
  when others then
    raise notice 'Error altering product_uoms unique constraint: %', sqlerrm;
end;
$$;
