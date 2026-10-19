-- Run ONLY in your project's SQL Editor after the admin migrations.
-- First invite/create your own user in Authentication > Users, then replace
-- this example address. Passwords are set through Supabase Auth, never in SQL.
do $$
declare account_id uuid;
begin
  select id into account_id from auth.users where lower(email)=lower('replace-with-your-own-email@example.invalid');
  if account_id is null then raise exception 'Create/invite the Auth user and replace the example email first.'; end if;
  insert into seen_private.admin_members(user_id,role,active) values(account_id,'owner',true)
  on conflict(user_id) do update set role='owner',active=true;
end $$;
