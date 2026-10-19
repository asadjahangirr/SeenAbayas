-- Adds atomic visibility changes to the existing protected bulk actions.
-- Installing this function does not publish or hide any products.
begin;
create or replace function public.admin_bulk_products(ids uuid[],operation text,quantity integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare incomplete text;
begin
  perform seen_private.require_admin();
  if ids is null or cardinality(ids) not between 1 and 500
    or exists(select 1 from unnest(ids) id where id is null)
    or (select count(distinct id) from unnest(ids) id)<>cardinality(ids) then
    raise exception 'Invalid selection';
  end if;
  perform 1 from public.products p where p.id=any(ids) order by p.id for update;
  if (select count(*) from public.products p where p.id=any(ids))<>cardinality(ids) then
    raise exception 'Selected products changed. Reload before saving.' using errcode='40001';
  end if;
  if operation='publish' then
    -- Validate every selection before writing, so a batch never partly publishes.
    select string_agg(p.design_reference, ', ' order by p.design_reference) into incomplete
    from public.products p where p.id=any(ids) and (
      p.name is null or p.description is null or p.price_pence is null
      or jsonb_array_length(p.photos)=0
      or not exists(select 1 from public.product_variants v where v.product_id=p.id and v.active)
      or exists(select 1 from public.product_variants v left join seen_private.inventory i on i.variant_id=v.id
        where v.product_id=p.id and v.active and i.variant_id is null)
    );
    if incomplete is not null then
      raise exception 'Cannot show selected products. Complete saved names, descriptions, prices, photos, active sizes and stock for: %', incomplete;
    end if;
    update public.products set status='published',details_confirmed=true where id=any(ids) and status<>'published';
  elsif operation='hide' then
    update public.products set status='draft' where id=any(ids) and status<>'draft';
  elsif operation='archive' then
    update public.products set status='archived' where id=any(ids);
  elsif operation='stock' and quantity between 0 and 1000000 then
    update seen_private.inventory set on_hand=quantity where variant_id in (select id from public.product_variants where product_id=any(ids));
  elsif operation='reorder' then
    update public.products p set sort_order=r.ordinality::integer from unnest(ids) with ordinality r(id,ordinality) where p.id=r.id;
  else raise exception 'Invalid operation'; end if;
  perform seen_private.audit(operation,'products',cardinality(ids)::text);
end $$;
revoke all on function public.admin_bulk_products(uuid[],text,integer) from public,anon;
grant execute on function public.admin_bulk_products(uuid[],text,integer) to authenticated;
commit;
