-- Owner-only permanent product deletion. Existing catalog/media are preserved
-- until an owner explicitly uses Delete product. Safe to rerun.
begin;
create or replace function public.admin_delete_product(product_id uuid, expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.products; references_to_check text[]; current_site seen_private.site_documents;
  next_draft jsonb; next_published jsonb;
begin
  perform seen_private.require_admin(true);
  select * into target from public.products where id=product_id for update;
  if target.id is null then raise exception 'Product no longer exists'; end if;
  if expected_updated_at is null or target.updated_at is distinct from expected_updated_at then
    raise exception 'Product changed. Reload before deleting.' using errcode='40001';
  end if;
  perform 1 from seen_private.inventory i join public.product_variants v on v.id=i.variant_id where v.product_id=target.id for update of i;
  if exists(select 1 from seen_private.inventory i join public.product_variants v on v.id=i.variant_id where v.product_id=target.id and i.reserved>0) then
    raise exception 'This product has reserved stock. Archive it instead.';
  end if;
  select array[target.id::text,target.design_reference] || coalesce(array_agg(v.id::text),'{}'::text[])
    into references_to_check from public.product_variants v where v.product_id=target.id;
  if exists(select 1 from seen_private.admin_records r,
    lateral jsonb_path_query(r.payload,'$.** ? (@.type() == "string")') value
    where r.kind='order' and (value#>>'{}')=any(references_to_check)) then
    raise exception 'This product is referenced by an order. Archive it instead.';
  end if;

  -- Remove only this product's homepage selection. Never publish unrelated drafts.
  select * into current_site from seen_private.site_documents where id for update;
  next_draft:=current_site.draft; next_published:=current_site.published;
  if jsonb_typeof(next_draft->'featured')='array' then
    next_draft:=jsonb_set(next_draft,'{featured}',coalesce((select jsonb_agg(value) from jsonb_array_elements(next_draft->'featured') where value<>to_jsonb(target.design_reference)),'[]'::jsonb));
  end if;
  if jsonb_typeof(next_published->'featured')='array' then
    next_published:=jsonb_set(next_published,'{featured}',coalesce((select jsonb_agg(value) from jsonb_array_elements(next_published->'featured') where value<>to_jsonb(target.design_reference)),'[]'::jsonb));
  end if;
  if next_draft is distinct from current_site.draft or next_published is distinct from current_site.published then
    update seen_private.site_documents set draft=next_draft,published=next_published,version=version+1,updated_at=clock_timestamp() where id;
  end if;
  -- Foreign keys deliberately restrict deletion; remove only this product's
  -- inventory and variants after the reservation/order checks have succeeded.
  delete from seen_private.inventory where variant_id in(select v.id from public.product_variants v where v.product_id=target.id);
  delete from public.product_variants v where v.product_id=target.id;
  delete from public.products where id=target.id;
  perform seen_private.audit('delete','product',target.id::text);
end $$;
revoke all on function public.admin_delete_product(uuid,timestamptz) from public,anon;
grant execute on function public.admin_delete_product(uuid,timestamptz) to authenticated;
commit;
