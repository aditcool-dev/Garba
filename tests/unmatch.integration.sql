\set ON_ERROR_STOP on
-- Run against an isolated PostgreSQL database with Supabase auth.uid()/roles and
-- migrations 001–009 applied. Uses real RLS, RPCs and transactions, not mocks.
grant all on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','a.cs24@bmsce.ac.in'),
 ('00000000-0000-4000-8000-000000000002','b.cs24@bmsce.ac.in'),
 ('00000000-0000-4000-8000-000000000003','c.cs24@bmsce.ac.in');
update public.profiles set onboarding_complete=true,first_name=case right(id::text,1) when '1' then 'A' when '2' then 'B' else 'C' end;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select public.like_user('00000000-0000-4000-8000-000000000002');
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select public.like_user('00000000-0000-4000-8000-000000000001');
select id as match_id,chat_started_at as first_generation from public.matches where user_b=auth.uid() \gset
insert into public.messages(match_id,sender_id,body,chat_started_at) values(:'match_id',auth.uid(),'OLD EVIDENCE',:'first_generation');
insert into public.passes(from_user,to_user) values(auth.uid(),'00000000-0000-4000-8000-000000000001');
\set report_id '00000000-0000-4000-8000-000000000010'
insert into public.reports(id,reporter_id,reported_user_id,reason,description) values(:'report_id',auth.uid(),'00000000-0000-4000-8000-000000000001','other','Prior chat report');
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
do $$begin
  begin perform public.unmatch_user((select id from public.matches limit 1)); raise exception 'nonparticipant allowed'; exception when others then if sqlerrm='nonparticipant allowed' then raise; end if; end;
end$$;
-- Test a known ID, even though RLS hides the row from C.
select set_config('test.match_id',:'match_id',false);
do $$begin
  begin perform public.unmatch_user(current_setting('test.match_id')::uuid); raise exception 'nonparticipant allowed'; exception when others then if sqlerrm='nonparticipant allowed' then raise; end if; end;
end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into public.passes(from_user,to_user) values(auth.uid(),'00000000-0000-4000-8000-000000000002');
select public.unmatch_user(:'match_id');
select public.unmatch_user(:'match_id');
reset role;
do $$begin if exists(select 1 from public.likes) or exists(select 1 from public.passes) then raise exception 'both directions not cleared'; end if; end$$;
set role authenticated;
do $$begin
  if exists(select 1 from public.matches where status='active') then raise exception 'still active'; end if;
  if not exists(select 1 from public.matches where unmatched_at is not null and unmatched_by=auth.uid()) then raise exception 'unmatch metadata missing'; end if;
  if exists(select 1 from public.likes) or exists(select 1 from public.passes) then raise exception 'pair decisions not cleared'; end if;
  if exists(select 1 from public.messages) then raise exception 'old messages visible'; end if;
end$$;
select set_config('test.generation',:'first_generation',false);
do $$begin
  begin insert into public.messages(match_id,sender_id,body,chat_started_at) values(current_setting('test.match_id')::uuid,auth.uid(),'late send',current_setting('test.generation')::timestamptz); raise exception 'unmatched send allowed'; exception when others then if sqlerrm='unmatched send allowed' then raise; end if; end;
end$$;
do $$begin
  if not exists(select 1 from public.discover_feed('same-seed') where profile->>'id'='00000000-0000-4000-8000-000000000002') then raise exception 'B not returned'; end if;
end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$begin
  if not exists(select 1 from public.discover_feed('same-seed') where profile->>'id'='00000000-0000-4000-8000-000000000001') then raise exception 'A not returned'; end if;
end$$;
select public.like_user('00000000-0000-4000-8000-000000000001');
do $$begin if exists(select 1 from public.matches where status='active') then raise exception 'one like rematched'; end if; end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select pg_sleep(.01);
select public.like_user('00000000-0000-4000-8000-000000000002');
do $$begin
  if (select count(*) from public.matches)<>1 or not exists(select 1 from public.matches where id=current_setting('test.match_id')::uuid and status='active' and chat_started_at>current_setting('test.generation')::timestamptz and unmatched_at is null and unmatched_by is null) then raise exception 'reactivation failed'; end if;
  if exists(select 1 from public.messages) then raise exception 'old messages resurfaced'; end if;
end$$;
select chat_started_at as second_generation from public.matches where id=:'match_id' \gset
insert into public.messages(match_id,sender_id,body,chat_started_at) values(:'match_id',auth.uid(),'NEW CHAT',:'second_generation');
do $$begin
  begin insert into public.messages(match_id,sender_id,body,chat_started_at) values(current_setting('test.match_id')::uuid,auth.uid(),'late old generation',current_setting('test.generation')::timestamptz); raise exception 'old generation allowed'; exception when others then if sqlerrm='old generation allowed' then raise; end if; end;
end$$;
select public.unmatch_user(:'match_id');
insert into public.blocks(blocker_id,blocked_id) values(auth.uid(),'00000000-0000-4000-8000-000000000002');
do $$begin if exists(select 1 from public.discover_feed('block-test') where profile->>'id'='00000000-0000-4000-8000-000000000002') then raise exception 'blocked B returned'; end if; end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$begin
  if exists(select 1 from public.discover_feed('block-test') where profile->>'id'='00000000-0000-4000-8000-000000000001') then raise exception 'blocked A returned'; end if;
  begin perform public.like_user('00000000-0000-4000-8000-000000000001'); raise exception 'blocked like allowed'; exception when others then if sqlerrm='blocked like allowed' then raise; end if; end;
end$$;
-- Keep the chat active here to ensure block RLS itself hides messages, rather
-- than passing only because the earlier unmatch already hid the conversation.
reset role;
update public.matches set status='active' where id=:'match_id';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from public.messages) then raise exception 'blocker can read chat'; end if; end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$begin
  if exists(select 1 from public.messages) then raise exception 'blocked participant can read chat'; end if;
end$$;
reset role;
update public.matches set status='unmatched' where id=:'match_id';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select public.mark_discover_tutorial_seen();
do $$begin
  if not (select has_seen_discover_tutorial from public.profiles where id=auth.uid()) then raise exception 'tutorial flag missing'; end if;
end$$;
select set_config('test.report_id',:'report_id',false);
do $$begin
  begin perform public.report_chat_evidence(current_setting('test.report_id')::uuid); raise exception 'nonadmin evidence allowed'; exception when others then if sqlerrm='nonadmin evidence allowed' then raise; end if; end;
end$$;
reset role;
insert into public.admin_users(user_id) values('00000000-0000-4000-8000-000000000003');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
select count(*)=2 as evidence_count from public.report_chat_evidence(:'report_id') \gset
\if :evidence_count
\echo 'Admin evidence retained'
\else
select 1/0;
\endif
reset role;
\echo 'Unmatch, RLS, block, tutorial and fresh-generation integration checks passed'
