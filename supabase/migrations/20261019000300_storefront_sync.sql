-- Public categories and a small change token for live storefront refreshes.
-- Apply after the administration and private media migrations. Safe to rerun.
begin;

create table if not exists seen_private.storefront_state (
  id boolean primary key default true check (id),
  revision uuid not null default gen_random_uuid()
);
insert into seen_private.storefront_state(id) values(true) on conflict(id) do nothing;
alter table seen_private.storefront_state enable row level security;
revoke all on seen_private.storefront_state from public, anon, authenticated;

create or replace function seen_private.mark_storefront_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changed boolean := false; parent_id uuid;
begin
  if tg_table_name = 'products' then
    if tg_op <> 'INSERT' then changed := old.status = 'published'; end if;
    if tg_op <> 'DELETE' then changed := changed or new.status = 'published'; end if;
  elsif tg_table_name = 'site_documents' then
    changed := new.published is distinct from old.published;
  elsif tg_table_name = 'admin_records' then
    if tg_op <> 'INSERT' then changed := old.kind = 'category'; end if;
    if tg_op <> 'DELETE' then changed := changed or new.kind = 'category'; end if;
  elsif tg_table_name = 'product_variants' then
    if tg_op = 'DELETE' then parent_id := old.product_id;
    else parent_id := new.product_id; end if;
    changed := exists(select 1 from public.products where id = parent_id and status = 'published');
  elsif tg_table_name = 'inventory' then
    if tg_op = 'DELETE' then parent_id := old.variant_id;
    else parent_id := new.variant_id; end if;
    changed := exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=parent_id and p.status='published');
  end if;
  if changed then update seen_private.storefront_state set revision=gen_random_uuid() where id; end if;
  return null;
end $$;

drop trigger if exists storefront_products_changed on public.products;
create trigger storefront_products_changed after insert or update or delete on public.products for each row execute function seen_private.mark_storefront_changed();
drop trigger if exists storefront_content_changed on seen_private.site_documents;
create trigger storefront_content_changed after update on seen_private.site_documents for each row execute function seen_private.mark_storefront_changed();
drop trigger if exists storefront_categories_changed on seen_private.admin_records;
create trigger storefront_categories_changed after insert or update or delete on seen_private.admin_records for each row execute function seen_private.mark_storefront_changed();
drop trigger if exists storefront_sizes_changed on public.product_variants;
create trigger storefront_sizes_changed after insert or update or delete on public.product_variants for each row execute function seen_private.mark_storefront_changed();
drop trigger if exists storefront_inventory_changed on seen_private.inventory;
create trigger storefront_inventory_changed after insert or update or delete on seen_private.inventory for each row execute function seen_private.mark_storefront_changed();

create or replace function public.get_storefront_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'revision', (select revision from seen_private.storefront_state where id),
    'categories', coalesce((select jsonb_agg(jsonb_build_object(
      'slug',payload->>'slug', 'name',payload->>'name',
      'description',coalesce(payload->>'description','')
    ) order by coalesce((payload->>'sort_order')::integer,0), payload->>'name', id)
    from seen_private.admin_records where kind='category'), '[]'::jsonb)
  );
$$;
revoke all on function public.get_storefront_state() from public;
grant execute on function public.get_storefront_state() to anon, authenticated;
revoke all on function seen_private.mark_storefront_changed() from public, anon, authenticated;

commit;
