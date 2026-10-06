-- Idempotent, conservative cleanup for legacy demo data only.
-- Never classify by a name, ordinary USN, photo, or email domain alone.
begin;
create temporary table legacy_demo_ids(id uuid primary key) on commit drop;
insert into legacy_demo_ids
select p.id from public.profiles p where p.is_demo=true or p.id::text ~ '^(demo-|bms-)'
union select u.id from auth.users u where coalesce(u.raw_app_meta_data->>'is_demo','false')='true'
  or coalesce(u.raw_app_meta_data->>'legacy_id','') ~ '^(demo-|bms-)';
select 'before' phase,
 (select count(*) from legacy_demo_ids) demo_profiles_or_auth_users,
 (select count(*) from public.likes where from_user in(select id from legacy_demo_ids) or to_user in(select id from legacy_demo_ids)) likes,
 (select count(*) from public.passes where from_user in(select id from legacy_demo_ids) or to_user in(select id from legacy_demo_ids)) passes,
 (select count(*) from public.matches where user_a in(select id from legacy_demo_ids) or user_b in(select id from legacy_demo_ids)) matches,
 (select count(*) from public.messages where sender_id in(select id from legacy_demo_ids) or match_id in(select id from public.matches where user_a in(select id from legacy_demo_ids) or user_b in(select id from legacy_demo_ids))) messages;

-- SQL cannot delete the underlying Storage blobs safely. Queue ONLY owned files
-- before deleting auth users; seed-samples.ts --remove-legacy-storage uses the
-- Storage API and removes queue entries only after successful blob removal.
create table if not exists public.legacy_demo_storage_cleanup(bucket_id text,object_name text,account_id uuid,primary key(bucket_id,object_name));
alter table public.legacy_demo_storage_cleanup add column if not exists account_id uuid;
alter table public.legacy_demo_storage_cleanup enable row level security;
revoke all on public.legacy_demo_storage_cleanup from public,anon,authenticated;
grant all on public.legacy_demo_storage_cleanup to service_role;
do $$begin
  if to_regclass('storage.objects') is not null then
    execute $q$insert into public.legacy_demo_storage_cleanup(bucket_id,object_name,account_id)
      select o.bucket_id,o.name,d.id from storage.objects o join legacy_demo_ids d on
      coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner','')=d.id::text
      or split_part(o.name,'/',1)=d.id::text
      on conflict(bucket_id,object_name) do update set account_id=excluded.account_id$q$;
  end if;
end;$$;
select count(*) owned_storage_objects_queued from public.legacy_demo_storage_cleanup;
delete from public.matches where user_a in(select id from legacy_demo_ids) or user_b in(select id from legacy_demo_ids);
delete from public.likes where from_user in(select id from legacy_demo_ids) or to_user in(select id from legacy_demo_ids);
delete from public.passes where from_user in(select id from legacy_demo_ids) or to_user in(select id from legacy_demo_ids);
update public.matches set unmatched_by=null where unmatched_by in(select id from legacy_demo_ids);
update public.reports set reviewed_by=null where reviewed_by in(select id from legacy_demo_ids);
delete from public.audit_log where admin_id in(select id from legacy_demo_ids);
-- Retain flagged auth/profile rows until their Storage objects have been removed.
-- This prevents auth deletion cascading Storage metadata before blob deletion.
delete from public.profiles where id in(select id from legacy_demo_ids) and not exists(select 1 from public.legacy_demo_storage_cleanup q where q.account_id=profiles.id);
delete from auth.users where id in(select id from legacy_demo_ids) and not exists(select 1 from public.legacy_demo_storage_cleanup q where q.account_id=users.id);
select 'after' phase,
 (select count(*) from public.profiles where id in(select id from legacy_demo_ids)) profiles,
 (select count(*) from auth.users where id in(select id from legacy_demo_ids)) auth_users,
 (select count(*) from public.likes where from_user in(select id from legacy_demo_ids) or to_user in(select id from legacy_demo_ids)) likes,
 (select count(*) from public.passes where from_user in(select id from legacy_demo_ids) or to_user in(select id from legacy_demo_ids)) passes,
 (select count(*) from public.matches where user_a in(select id from legacy_demo_ids) or user_b in(select id from legacy_demo_ids)) matches,
 (select count(*) from public.messages where sender_id in(select id from legacy_demo_ids)) messages;
commit;
