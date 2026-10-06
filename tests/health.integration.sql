\set ON_ERROR_STOP on
-- Disposable database only. Auth API behaviour is modelled by fixtures here;
-- shipping seed scripts use the Admin API, never SQL inserts into auth.users.
begin;
update public.app_settings set value=true where key='SHOW_SAMPLE_PROFILES';
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000201','healtha@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000202','healthb@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000204','pending@bmsce.ac.in',null);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000203','floor-01@samples.garbamate.invalid',now(),'{"is_sample":true}');
update public.profiles set onboarding_complete=true,first_name='Health Dancer' where id in('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000203');
update public.profiles set photo_path='🌸' where id='00000000-0000-4000-8000-000000000203';
do $$begin
  if exists(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000203' and (not is_sample or is_verified)) then raise exception 'sample badge trust';end if;
  if exists(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000204' and is_verified) then raise exception 'unconfirmed badge';end if;
  begin insert into auth.users(id,email) values(gen_random_uuid(),'x@gmail.com');raise exception 'gmail allowed';exception when others then if sqlerrm='gmail allowed' then raise;end if;end;
  insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000205','floor-30@samples.garbamate.invalid','{"is_sample":true}');
  if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000205' and banned_until is not null) then raise exception 'reserved public signup was usable';end if;
  begin insert into auth.users(id,email,raw_app_meta_data) values(gen_random_uuid(),'not-sample@gmail.com','{"is_sample":true}');raise exception 'sample marker bypassed email rule';exception when others then if sqlerrm='sample marker bypassed email rule' then raise;end if;end;
end;$$;
insert into public.likes(from_user,to_user,kind) values('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000201','interested');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000201';
do $$declare result jsonb;begin
  if not exists(select 1 from public.discover_feed('sample') where profile->>'id'='00000000-0000-4000-8000-000000000203') then raise exception 'sample missing';end if;
  if exists(select 1 from public.discover_feed('sample') where profile ? 'is_sample' or profile ? 'is_demo' or profile ? 'usn' or profile ? 'email') then raise exception 'internal fields leaked';end if;
  result:=public.like_user('00000000-0000-4000-8000-000000000203');if (result->>'matched')::boolean then raise exception 'sample matched';end if;
  if exists(select 1 from public.get_user_notifications()) then raise exception 'sample notified';end if;
  if exists(select 1 from public.get_incoming_interests() where from_user='00000000-0000-4000-8000-000000000203') then raise exception 'sample incoming';end if;
  begin update public.profiles set is_verified=false where id=auth.uid();raise exception 'trust edit allowed';exception when others then if sqlerrm='trust edit allowed' then raise;end if;end;
  begin perform is_sample from public.profiles limit 1;raise exception 'sample flag readable';exception when insufficient_privilege then null;end;
  begin insert into public.matches(user_a,user_b) values(auth.uid(),'00000000-0000-4000-8000-000000000202');raise exception 'direct match allowed';exception when others then if sqlerrm='direct match allowed' then raise;end if;end;
end;$$;
select public.like_user('00000000-0000-4000-8000-000000000202');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000202';
select public.like_user('00000000-0000-4000-8000-000000000201');
select id as match_id,chat_started_at as epoch from public.matches where user_a='00000000-0000-4000-8000-000000000201' \gset
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000201';
insert into public.messages(match_id,sender_id,body,chat_started_at) values(:'match_id',auth.uid(),'Hello',:'epoch'),(:'match_id',auth.uid(),'Choose a night?',:'epoch');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000202';
do $$begin if (select unread_count from public.get_user_notifications() limit 1)<>2 then raise exception 'unread count wrong';end if;end$$;
select public.mark_chat_read(:'match_id');
do $$begin if exists(select 1 from public.get_user_notifications()) then raise exception 'read not cleared';end if;end$$;
select public.unmatch_user(:'match_id');
do $$begin if exists(select 1 from public.get_user_notifications()) or exists(select 1 from public.messages) then raise exception 'unmatch messages resurfaced';end if;end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000203';
do $$begin begin perform public.like_user('00000000-0000-4000-8000-000000000201');raise exception 'sample actor allowed';exception when others then if sqlerrm='sample actor allowed' then raise;end if;end;end$$;
reset role;
update public.app_settings set value=false where key='SHOW_SAMPLE_PROFILES';
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000202';
do $$begin if exists(select 1 from public.discover_feed('hidden') where profile->>'id'='00000000-0000-4000-8000-000000000203') then raise exception 'sample hide failed';end if;end$$;
insert into public.reports(reporter_id,reported_user_id,reason,description) values(auth.uid(),'00000000-0000-4000-8000-000000000201','other','Health report');
reset role;
insert into public.admin_users(user_id) values('00000000-0000-4000-8000-000000000201');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000201';
do $$begin
  if exists(select 1 from public.get_admin_profiles() p where p->>'id'='00000000-0000-4000-8000-000000000203') then raise exception 'sample in admin';end if;
  if not exists(select 1 from public.reports where description='Health report') then raise exception 'admin report missing';end if;
end;$$;
reset role;
do $$begin if exists(select 1 from pg_tables t join pg_class c on c.oid=(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass where t.schemaname='public' and not c.relrowsecurity) then raise exception 'RLS disabled';end if;end$$;
rollback;
\echo 'Health sample/auth/trust/RLS/unread/report checks passed'
