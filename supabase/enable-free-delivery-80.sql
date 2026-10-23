-- OPERATOR ACTION: enable free standard UK delivery at GBP 80 and above,
-- as requested by the store owner. Run once in the existing SQL Editor.
-- Rerunnable. Does not change products, stock, orders, weights or payment modes.
-- Patches draft/published commerce only; unrelated unpublished edits stay private.
begin;
do $$
declare current_row seen_private.site_documents; next_draft jsonb; next_published jsonb;
begin
  select * into current_row from seen_private.site_documents where id for update;
  if current_row.id is null or current_row.published is null then
    raise exception 'Publish the existing website settings before enabling this delivery offer';
  end if;
  next_draft:=jsonb_set(current_row.draft,'{commerce}',coalesce(current_row.draft->'commerce','{}'::jsonb)
    ||jsonb_build_object('freeDeliveryEnabled',true,'freeDeliveryThresholdPence',8000));
  next_published:=jsonb_set(current_row.published,'{commerce}',coalesce(current_row.published->'commerce','{}'::jsonb)
    ||jsonb_build_object('freeDeliveryEnabled',true,'freeDeliveryThresholdPence',8000));
  if next_draft is distinct from current_row.draft or next_published is distinct from current_row.published then
    insert into seen_private.site_history(version,document) values(current_row.version,current_row.published) on conflict do nothing;
    update seen_private.site_documents set draft=next_draft,published=next_published,
      version=version+1,updated_at=clock_timestamp(),published_at=clock_timestamp() where id;
    insert into seen_private.site_history(version,document) values(current_row.version+1,next_published);
    delete from seen_private.site_history where version not in(select version from seen_private.site_history order by version desc limit 30);
    insert into seen_private.admin_audit(action,entity,entity_id)
      values('enable_free_standard_delivery_80','site',(current_row.version+1)::text);
  end if;
end $$;
commit;
select published#>>'{commerce,freeDeliveryEnabled}' as free_standard_delivery_enabled,
  (published#>>'{commerce,freeDeliveryThresholdPence}')::integer/100 as threshold_gbp
from seen_private.site_documents where id;
