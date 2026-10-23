-- Requested password-only administration and private username/email setup.
-- Apply after the shipping read-compatibility migration. Safe to rerun.
-- Existing owners/editors remain approved. No account/password is hardcoded,
-- no user is created, no email is sent, and no store/order/stock data is changed.
begin;

create or replace function public.is_seen_admin(owner_only boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'aal','') in ('aal1','aal2')
    and exists(select 1 from seen_private.admin_members where user_id=auth.uid()
      and active and (not owner_only or role='owner'));
$$;
create or replace function public.admin_access() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce((select jsonb_build_object('role',role,'allowed',active,
    'mfa',coalesce(auth.jwt()->>'aal','')='aal2','password_only_ready',true)
    from seen_private.admin_members where user_id=auth.uid()),
    '{"allowed":false,"mfa":false,"password_only_ready":true}'::jsonb);
$$;

create table if not exists seen_private.admin_profiles(
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check(username ~ '^[a-z][a-z0-9._-]{2,39}$'),
  display_name text not null check(length(display_name) between 1 and 80),
  created_at timestamptz not null default clock_timestamp()
);
create table if not exists seen_private.admin_auth_guard(id integer primary key check(id=1));
insert into seen_private.admin_auth_guard values(1) on conflict do nothing;
create table if not exists seen_private.admin_auth_attempts(
  id bigint generated always as identity primary key, identity_hash text not null,
  network_hash text not null, action text not null, created_at timestamptz not null default clock_timestamp()
);
create index if not exists admin_auth_attempt_time on seen_private.admin_auth_attempts(created_at);
create index if not exists admin_auth_attempt_identity on seen_private.admin_auth_attempts(identity_hash,action,created_at);
create index if not exists admin_auth_attempt_network on seen_private.admin_auth_attempts(network_hash,created_at);
create table if not exists seen_private.admin_email_requests(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'), email text not null,
  previous_email text not null, expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
  used_at timestamptz, created_at timestamptz not null default clock_timestamp()
);
alter table seen_private.admin_profiles enable row level security;
alter table seen_private.admin_auth_guard enable row level security;
alter table seen_private.admin_auth_attempts enable row level security;
alter table seen_private.admin_email_requests enable row level security;
revoke all on seen_private.admin_profiles,seen_private.admin_auth_guard,seen_private.admin_auth_attempts,
  seen_private.admin_email_requests from public,anon,authenticated,service_role;

create or replace function public.admin_account_lookup(identifier text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('userId',u.id,'email',u.email,'username',p.username)
  from auth.users u join seen_private.admin_members m on m.user_id=u.id and m.active
  left join seen_private.admin_profiles p on p.user_id=u.id
  where lower(u.email)=lower(identifier) or p.username=lower(identifier) limit 1;
$$;
create or replace function public.admin_account_attempt(identity_hash text,network_hash text,action text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(identity_hash,'') !~ '^[a-f0-9]{64}$' or coalesce(network_hash,'') !~ '^[a-f0-9]{64}$'
    or action not in ('login','recover','email','confirm','password','create') then raise exception 'Invalid account request'; end if;
  perform 1 from seen_private.admin_auth_guard where id=1 for update;
  if (select count(*) from seen_private.admin_auth_attempts a where a.identity_hash=admin_account_attempt.identity_hash
      and a.action=admin_account_attempt.action and a.created_at>clock_timestamp()-interval '15 minutes')>=10
    or (select count(*) from seen_private.admin_auth_attempts a where a.network_hash=admin_account_attempt.network_hash
      and a.created_at>clock_timestamp()-interval '15 minutes')>=80
    or (select count(*) from seen_private.admin_auth_attempts a where a.created_at>clock_timestamp()-interval '1 minute')>=200 then
    raise exception 'Account rate limit exceeded';
  end if;
  insert into seen_private.admin_auth_attempts(identity_hash,network_hash,action) values(identity_hash,network_hash,action);
  delete from seen_private.admin_auth_attempts where created_at<clock_timestamp()-interval '1 day';
end $$;

create or replace function public.admin_account_register(operator_id uuid,user_id uuid,username text,display_name text,member_role text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from seen_private.admin_members m where m.user_id=operator_id and m.active and m.role='owner')
    then raise exception 'Owner access required' using errcode='42501'; end if;
  if username !~ '^[a-z][a-z0-9._-]{2,39}$' or length(display_name) not between 1 and 80
    or member_role not in ('owner','editor') or exists(select 1 from seen_private.admin_members m where m.user_id=admin_account_register.user_id)
    then raise exception 'Invalid new administrator'; end if;
  insert into seen_private.admin_members(user_id,role) values(user_id,member_role);
  insert into seen_private.admin_profiles(user_id,username,display_name) values(user_id,username,display_name);
  insert into seen_private.admin_audit(actor,action,entity,entity_id) values(operator_id,'add administrator','account',user_id::text);
end $$;
create or replace function public.admin_account_team() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform seen_private.require_admin(true);
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,'active',m.active,
    'username',p.username,'displayName',coalesce(p.display_name,split_part(u.email,'@',1)),
    'email',case when u.email like '%@admin.invalid' then null else u.email end,
    'emailVerified',u.email_confirmed_at is not null and u.email not like '%@admin.invalid') order by m.created_at)
    from seen_private.admin_members m join auth.users u on u.id=m.user_id left join seen_private.admin_profiles p on p.user_id=u.id),'[]'::jsonb);
end $$;

create or replace function public.admin_account_email_request(user_id uuid,email text,token_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare request_id uuid; old_email text;
begin
  if not exists(select 1 from seen_private.admin_members m where m.user_id=admin_account_email_request.user_id and m.active)
    or coalesce(length(email),0) not between 3 and 254 or email like '%@admin.invalid'
    or coalesce(token_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid email request'; end if;
  select u.email into strict old_email from auth.users u where u.id=admin_account_email_request.user_id;
  if exists(select 1 from auth.users u where lower(u.email)=lower(admin_account_email_request.email) and u.id<>admin_account_email_request.user_id)
    then raise exception 'Email address is already in use'; end if;
  insert into seen_private.admin_email_requests(user_id,email,token_hash,previous_email)
    values(user_id,lower(email),token_hash,old_email) returning id into request_id;
  delete from seen_private.admin_email_requests where created_at<clock_timestamp()-interval '1 day';
  return request_id;
end $$;
create or replace function public.admin_account_claim_email(token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r seen_private.admin_email_requests;
begin
  select * into r from seen_private.admin_email_requests q where q.token_hash=admin_account_claim_email.token_hash for update;
  if r.id is null or r.used_at is not null or r.expires_at<=clock_timestamp()
    or not exists(select 1 from seen_private.admin_members m where m.user_id=r.user_id and m.active)
    or not exists(select 1 from auth.users u where u.id=r.user_id and u.email=r.previous_email)
    then raise exception 'Email link is invalid or expired'; end if;
  update seen_private.admin_email_requests set used_at=clock_timestamp() where id=r.id;
  return jsonb_build_object('userId',r.user_id,'email',r.email,'previousEmail',r.previous_email);
end $$;

revoke all on function public.admin_account_lookup(text),public.admin_account_attempt(text,text,text),
  public.admin_account_register(uuid,uuid,text,text,text),public.admin_account_email_request(uuid,text,text),
  public.admin_account_claim_email(text) from public,anon,authenticated;
grant execute on function public.admin_account_lookup(text),public.admin_account_attempt(text,text,text),
  public.admin_account_register(uuid,uuid,text,text,text),public.admin_account_email_request(uuid,text,text),
  public.admin_account_claim_email(text) to service_role;
revoke all on function public.admin_account_team() from public,anon,service_role;
grant execute on function public.admin_account_team() to authenticated;
commit;
