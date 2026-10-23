-- HOTFIX for the already-installed shipping migration. Run this complete file
-- in the existing Supabase SQL Editor. No website redeployment is needed for
-- this database read correction. Expected: Success. No rows returned.
--
-- Fixed delivery keeps the pre-shipping public content contract so an older
-- deployed storefront can still read it. Current code defaults missing
-- shipping to fixed mode. Carrier mode exposes only its required public mode;
-- origin, weights and dimensions always stay private.
--
-- Safe to rerun. Does not update settings, orders, stock, payments or grants.
begin;
create or replace function public.get_site_document() returns jsonb
language sql stable security definer set search_path='' as $$
  select case
    when published is null then null
    when coalesce(published#>>'{shipping,mode}','fixed')='fixed' then published-'shipping'
    else jsonb_set(published,'{shipping}',
      jsonb_build_object('mode',coalesce(published#>>'{shipping,mode}','fixed')),true)
    end
  from seen_private.site_documents where id;
$$;
commit;
