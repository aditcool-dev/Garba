\set ON_ERROR_STOP on
-- Disposable fixtures: preserve one real user and remove one flagged demo with
-- both-direction decisions, a conversation, and owned Storage metadata queued.
delete from auth.users where id in('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302');
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000301','keep@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000302','remove@bmsce.ac.in',now());
update public.profiles set onboarding_complete=true where id in('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302');
insert into public.likes(from_user,to_user,kind) values
 ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302','interested'),
 ('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000301','interested');
insert into public.passes(from_user,to_user) values('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000301');
insert into public.matches(user_a,user_b) values('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302') returning id as cleanup_match,chat_started_at as cleanup_epoch \gset
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000301';
insert into public.messages(match_id,sender_id,body,chat_started_at) values(:'cleanup_match',auth.uid(),'Fixture',:'cleanup_epoch');
update public.profiles set is_demo=true where id='00000000-0000-4000-8000-000000000302';
create schema if not exists storage;
create table if not exists storage.objects(bucket_id text,name text,owner_id text);
delete from storage.objects where owner_id in('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302');
insert into storage.objects values('avatars','00000000-0000-4000-8000-000000000302/avatar.jpg','00000000-0000-4000-8000-000000000302'),('avatars','00000000-0000-4000-8000-000000000301/avatar.jpg','00000000-0000-4000-8000-000000000301');
\ir ../supabase/cleanup-legacy-demo.sql
\ir ../supabase/cleanup-legacy-demo.sql
do $$begin
 if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000301') then raise exception 'real user deleted';end if;
 if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000302') then raise exception 'auth deleted before blob removal';end if;
 if exists(select 1 from public.likes where from_user='00000000-0000-4000-8000-000000000302' or to_user='00000000-0000-4000-8000-000000000302') then raise exception 'decisions left';end if;
 if (select count(*) from public.legacy_demo_storage_cleanup)<>1 then raise exception 'storage queue wrong';end if;
 if exists(select 1 from public.legacy_demo_storage_cleanup where object_name like '00000000-0000-4000-8000-000000000301%') then raise exception 'real storage queued';end if;
end;$$;
\echo 'Cleanup twice removes demo relationships, defers auth deletion until Storage API removal, preserves real users/files'
