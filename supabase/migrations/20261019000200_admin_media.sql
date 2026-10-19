begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('seen-media','seen-media',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function public.is_published_seen_media(object_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select object_name ~ '^[a-f0-9-]+\.(webp|jpg|png|mp4)$' and (
    exists(select 1 from seen_private.site_documents where position(('"/api/media/'||object_name||'"') in published::text)>0)
    or exists(select 1 from public.products where status='published' and details_confirmed and position(('"/api/media/'||object_name||'"') in photos::text)>0)
  );
$$;
revoke all on function public.is_published_seen_media(text) from public;
grant execute on function public.is_published_seen_media(text) to anon,authenticated;
create policy "Administrators upload media" on storage.objects for insert to authenticated with check(bucket_id='seen-media' and public.is_seen_admin() and name ~ '^[a-f0-9-]+\.(webp|jpg|png|mp4)$');
create policy "Published or administrator media reads" on storage.objects for select to anon,authenticated using(bucket_id='seen-media' and (public.is_seen_admin() or public.is_published_seen_media(name)));
-- Overwrites are deliberately disabled: changing a file gets a new immutable URL.
create function public.is_retained_seen_media(object_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_seen_admin() and (
    exists(select 1 from seen_private.site_documents where position(('"/api/media/'||object_name||'"') in draft::text)>0 or position(('"/api/media/'||object_name||'"') in published::text)>0)
    or exists(select 1 from seen_private.site_history where position(('"/api/media/'||object_name||'"') in document::text)>0)
    or exists(select 1 from public.products where position(('"/api/media/'||object_name||'"') in photos::text)>0)
  );
$$;
revoke all on function public.is_retained_seen_media(text) from public,anon;
grant execute on function public.is_retained_seen_media(text) to authenticated;
create policy "Administrators remove unused media" on storage.objects for delete to authenticated using(bucket_id='seen-media' and public.is_seen_admin() and not public.is_retained_seen_media(name));
-- A snapshot cannot publish dangling upload references. Existing checked-in
-- /images and /videos files remain valid without a Storage object.
create function seen_private.assert_media_references(document jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare item jsonb; value text;
begin
  for item in select jsonb_path_query(document,'$.** ? (@.type() == "string")') loop
    value:=item#>>'{}';
    if value like '/api/media/%' and not exists(select 1 from storage.objects where bucket_id='seen-media' and name=substr(value,12)) then raise exception 'An uploaded file is missing'; end if;
  end loop;
end $$;
create function seen_private.check_published_media() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='site_documents' then perform seen_private.assert_media_references(new.draft); perform seen_private.assert_media_references(new.published);
  else perform seen_private.assert_media_references(new.photos); end if;
  return new;
end $$;
create trigger site_media_references before update on seen_private.site_documents for each row execute function seen_private.check_published_media();
create trigger product_media_references before insert or update on public.products for each row execute function seen_private.check_published_media();
revoke all on function seen_private.assert_media_references(jsonb),seen_private.check_published_media() from public,anon,authenticated;
commit;
