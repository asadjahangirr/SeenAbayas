begin;

create schema if not exists seen_private;
revoke all on schema seen_private from public, anon, authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  design_reference text not null unique check (design_reference ~ '^design-[0-9]{2,4}$'),
  name text check (name is null or (name = btrim(name) and char_length(name) between 1 and 150)),
  description text check (description is null or char_length(btrim(description)) between 1 and 2000),
  price_pence integer check (price_pence between 1 and 99999999),
  currency text not null default 'GBP' check (currency = 'GBP'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  details_confirmed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_product_has_confirmed_details check (
    status <> 'published' or (
      details_confirmed and name is not null and description is not null and price_pence is not null
    )
  )
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  size_label text not null check (size_label = btrim(size_label) and char_length(size_label) between 1 and 50),
  sku text unique check (sku is null or char_length(btrim(sku)) between 1 and 80),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index product_variants_unique_size on public.product_variants(product_id, lower(size_label));
create index product_variants_catalog_order on public.product_variants(product_id, sort_order, id) where active;
create index products_catalog_order on public.products(sort_order, id) where status = 'published';

-- A missing row means stock is unknown. Zero is reserved for confirmed zero stock.
create table seen_private.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete restrict,
  on_hand integer not null check (on_hand between 0 and 1000000),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table seen_private.inventory enable row level security;

revoke all on public.products, public.product_variants, seen_private.inventory from public, anon, authenticated;
grant select on public.products, public.product_variants to anon, authenticated;

create policy published_products_read on public.products for select to anon, authenticated
  using (status = 'published' and details_confirmed);
create policy published_active_variants_read on public.product_variants for select to anon, authenticated
  using (active and exists (
    select 1 from public.products p where p.id = product_id and p.status = 'published' and p.details_confirmed
  ));
-- No browser role receives a write policy or inventory permission.

create function seen_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function seen_private.touch_updated_at() from public, anon, authenticated;
create trigger products_updated_at before update on public.products for each row execute function seen_private.touch_updated_at();
create trigger variants_updated_at before update on public.product_variants for each row execute function seen_private.touch_updated_at();
create trigger inventory_updated_at before update on seen_private.inventory for each row execute function seen_private.touch_updated_at();

create function seen_private.assert_product_ready(target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.products where id = target_id and status = 'published') then
    return;
  end if;
  if not exists (select 1 from public.product_variants where product_id = target_id and active)
    or exists (
      select 1 from public.product_variants v
      left join seen_private.inventory i on i.variant_id = v.id
      where v.product_id = target_id and v.active and i.variant_id is null
    ) then
    raise exception using errcode = '23514', message = 'Published products require active sizes with confirmed inventory.';
  end if;
end;
$$;
revoke all on function seen_private.assert_product_ready(uuid) from public, anon, authenticated;

create function seen_private.check_catalog_readiness() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_product uuid;
  new_product uuid;
begin
  if tg_table_schema = 'public' and tg_table_name = 'products' then
    if tg_op <> 'DELETE' then new_product := new.id; end if;
    if tg_op <> 'INSERT' then old_product := old.id; end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'product_variants' then
    if tg_op <> 'DELETE' then new_product := new.product_id; end if;
    if tg_op <> 'INSERT' then old_product := old.product_id; end if;
  else
    if tg_op <> 'DELETE' then
      select product_id into new_product from public.product_variants where id = new.variant_id;
    end if;
    if tg_op <> 'INSERT' then
      select product_id into old_product from public.product_variants where id = old.variant_id;
    end if;
  end if;
  if old_product is not null then perform seen_private.assert_product_ready(old_product); end if;
  if new_product is not null and new_product is distinct from old_product then
    perform seen_private.assert_product_ready(new_product);
  end if;
  return null;
end;
$$;
revoke all on function seen_private.check_catalog_readiness() from public, anon, authenticated;

-- Deferred checks support an atomic import of the product, sizes and actual stock.
create constraint trigger products_ready after insert or update or delete on public.products
  deferrable initially deferred for each row execute function seen_private.check_catalog_readiness();
create constraint trigger variants_ready after insert or update or delete on public.product_variants
  deferrable initially deferred for each row execute function seen_private.check_catalog_readiness();
create constraint trigger inventory_ready after insert or update or delete on seen_private.inventory
  deferrable initially deferred for each row execute function seen_private.check_catalog_readiness();

-- This deliberately narrow public function is the only inventory projection.
-- It reveals availability, never exact stock, reservations or SKU values.
create function public.get_storefront_catalog()
returns table (
  product_id uuid,
  design_reference text,
  name text,
  description text,
  price_pence integer,
  currency text,
  variants jsonb
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.design_reference, p.name, p.description, p.price_pence, p.currency,
    (
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'size_label', v.size_label, 'available', (i.on_hand - i.reserved > 0)
      ) order by v.sort_order, v.id)
      from public.product_variants v
      join seen_private.inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.active
    )
  from public.products p
  where p.status = 'published' and p.details_confirmed
    and p.name is not null and p.description is not null and p.price_pence is not null
    and exists (select 1 from public.product_variants v join seen_private.inventory i on i.variant_id = v.id where v.product_id = p.id and v.active)
    and not exists (select 1 from public.product_variants v left join seen_private.inventory i on i.variant_id = v.id where v.product_id = p.id and v.active and i.variant_id is null)
  order by p.sort_order, p.id;
$$;
revoke all on function public.get_storefront_catalog() from public, anon, authenticated;
grant execute on function public.get_storefront_catalog() to anon, authenticated;

comment on table public.products is 'Approved commerce data. Draft photography references are not sellable products.';
comment on table seen_private.inventory is 'Private quantities; browser roles can only read availability through get_storefront_catalog.';
comment on function public.get_storefront_catalog() is 'Read-only public catalog. Does not reserve stock or authorize checkout.';

commit;
