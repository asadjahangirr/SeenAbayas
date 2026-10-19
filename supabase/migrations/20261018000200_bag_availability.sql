begin;

-- Read-only quantity checks. Returns a yes/no answer, never private stock counts.
-- A bag is not a reservation; checkout must validate and reserve atomically later.
create function public.check_bag_availability(requested_lines jsonb)
returns table (variant_id uuid, can_fulfil boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  item jsonb;
begin
  if jsonb_typeof(requested_lines) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid bag request.';
  end if;
  if jsonb_array_length(requested_lines) > 20 then
    raise exception using errcode = '22023', message = 'Invalid bag request.';
  end if;
  for item in select value from jsonb_array_elements(requested_lines) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'variant_id') is distinct from 'string'
      or jsonb_typeof(item->'quantity') is distinct from 'number'
      or (item - 'variant_id' - 'quantity') <> '{}'::jsonb
      or (item->>'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (item->>'quantity') !~ '^([1-9]|10)$' then
      raise exception using errcode = '22023', message = 'Invalid bag request.';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(requested_lines) r
    group by (r->>'variant_id')::uuid having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Invalid bag request.';
  end if;
  return query
    select (r->>'variant_id')::uuid,
      coalesce(v.active and p.status = 'published' and p.details_confirmed
        and i.on_hand - i.reserved >= (r->>'quantity')::integer, false)
    from jsonb_array_elements(requested_lines) r
    left join public.product_variants v on v.id = (r->>'variant_id')::uuid
    left join public.products p on p.id = v.product_id
    left join seen_private.inventory i on i.variant_id = v.id;
end;
$$;

revoke all on function public.check_bag_availability(jsonb) from public, anon, authenticated;
grant execute on function public.check_bag_availability(jsonb) to anon, authenticated;
comment on function public.check_bag_availability(jsonb) is 'Bounded, read-only bag quantity check. Does not expose counts or reserve stock.';

commit;
