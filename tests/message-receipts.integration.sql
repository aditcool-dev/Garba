\set ON_ERROR_STOP on
-- Disposable real PostgreSQL/RLS only; rollback all fixture data.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000501','receipt-a@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000502','receipt-b@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000503','receipt-c@bmsce.ac.in',now());
update public.profiles set first_name='Receipt account',onboarding_complete=true,is_verified=true where id in('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000503');
with m as (insert into public.matches(user_a,user_b,status,chat_started_at) values('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000502','active',clock_timestamp()) returning id)
select set_config('test.receipt_match',id::text,true) from m;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000501';
do $$declare m matches; msg messages;begin
  select * into m from matches where id=current_setting('test.receipt_match')::uuid;
  msg:=public.send_chat_message(m.id,'00000000-0000-4000-8000-000000000551','Receipt flow',m.chat_started_at);
  if msg.delivered_at is not null or msg.read_at is not null then raise exception 'new send has receipts'; end if;
  perform public.send_chat_message(m.id,msg.id,msg.body,m.chat_started_at);
  if (select count(*) from messages where id=msg.id)<>1 then raise exception 'retry duplicated'; end if;
  perform public.mark_messages_delivered(m.id); perform public.mark_chat_read(m.id);
  if exists(select 1 from messages where id=msg.id and (delivered_at is not null or read_at is not null)) then raise exception 'sender marked own message'; end if;
  begin update messages set body='edited',read_at=now(),delivered_at=now() where id=msg.id; raise exception 'direct message edit accepted'; exception when insufficient_privilege then null;end;
  begin insert into messages(match_id,sender_id,body,chat_started_at,delivered_at,read_at) values(m.id,auth.uid(),'Forged receipt',m.chat_started_at,now(),now()); raise exception 'forged insert accepted';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000503';
do $$begin
  begin perform public.mark_messages_delivered(current_setting('test.receipt_match')::uuid);raise exception 'outsider delivery accepted';exception when raise_exception then if sqlerrm<>'not a participant' then raise;end if;end;
  begin perform public.mark_chat_read(current_setting('test.receipt_match')::uuid);raise exception 'outsider read accepted';exception when raise_exception then if sqlerrm<>'not a participant' then raise;end if;end;
  if exists(select 1 from messages where match_id=current_setting('test.receipt_match')::uuid) then raise exception 'outsider saw messages';end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000502';
do $$declare m uuid:=current_setting('test.receipt_match')::uuid; before timestamptz;begin
  perform public.mark_messages_delivered(m);
  if not exists(select 1 from messages where id='00000000-0000-4000-8000-000000000551' and delivered_at is not null and read_at is null) then raise exception 'delivery timestamp incorrect';end if;
  select delivered_at into before from messages where id='00000000-0000-4000-8000-000000000551';
  perform public.mark_messages_delivered(m);
  if (select delivered_at from messages where id='00000000-0000-4000-8000-000000000551')<>before then raise exception 'delivery not idempotent';end if;
  update profiles set read_receipts_enabled=false where id=auth.uid();
  perform public.mark_chat_read(m,array['00000000-0000-4000-8000-000000000551']::uuid[]);
  if exists(select 1 from messages where id='00000000-0000-4000-8000-000000000551' and read_at is not null) then raise exception 'opt-out bypass';end if;
  if (select unread_count from public.get_chat_unread_counts() where match_id=m)<>0 then raise exception 'private seen did not clear unread';end if;
  begin perform * from public.message_seen_private;raise exception 'private seen exposed';exception when insufficient_privilege then null;end;
  update profiles set read_receipts_enabled=true where id=auth.uid();
  perform public.mark_chat_read(m,array['00000000-0000-4000-8000-000000000551']::uuid[]);
  if not exists(select 1 from messages where id='00000000-0000-4000-8000-000000000551' and delivered_at is not null and read_at is not null) then raise exception 'read timestamp missing';end if;
end$$;
-- Leave a deliberately postdated old-epoch message unacknowledged.
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000501';
insert into public.messages(id,match_id,sender_id,body,chat_started_at,created_at)
select '00000000-0000-4000-8000-000000000552',id,auth.uid(),'Old epoch, postdated',chat_started_at,'2099-01-01' from matches where id=current_setting('test.receipt_match')::uuid;
insert into public.messages(id,match_id,sender_id,body,chat_started_at)
select '00000000-0000-4000-8000-000000000554',id,auth.uid(),'Legacy null epoch',chat_started_at from matches where id=current_setting('test.receipt_match')::uuid;
reset role;
update messages set created_at='2099-01-01' where id='00000000-0000-4000-8000-000000000552';
update messages set chat_started_at=null where id='00000000-0000-4000-8000-000000000554';
set local role authenticated;
select public.unmatch_user(current_setting('test.receipt_match')::uuid);
select public.mark_messages_delivered(current_setting('test.receipt_match')::uuid);
select public.mark_chat_read(current_setting('test.receipt_match')::uuid);
select public.set_decision('00000000-0000-4000-8000-000000000502','interested');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000502';
select public.set_decision('00000000-0000-4000-8000-000000000501','interested');
select public.mark_messages_delivered(current_setting('test.receipt_match')::uuid);
select public.mark_chat_read(current_setting('test.receipt_match')::uuid);
do $$begin
  if exists(select 1 from messages where match_id=current_setting('test.receipt_match')::uuid) then raise exception 'old messages revealed';end if;
  if (select unread_count from public.get_chat_unread_counts() where match_id=current_setting('test.receipt_match')::uuid)<>0 then raise exception 'old message counted';end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000501';
do $$declare m matches;begin
  select * into m from matches where id=current_setting('test.receipt_match')::uuid;
  begin
    perform public.send_chat_message(m.id,'00000000-0000-4000-8000-000000000554','Legacy null epoch',m.chat_started_at);
    raise exception 'legacy old row revealed by retry';
  exception when raise_exception then if sqlerrm<>'message identity conflict' then raise;end if;end;
end$$;
reset role;
do $$begin
  if exists(select 1 from messages where id='00000000-0000-4000-8000-000000000552' and (delivered_at is not null or read_at is not null)) then raise exception 'old message marked after rematch';end if;
end$$;
-- Even a block that leaves an active match must prevent acknowledgements.
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000501';
insert into public.messages(id,match_id,sender_id,body,chat_started_at)
select '00000000-0000-4000-8000-000000000553',id,user_a,'Blocked fixture',chat_started_at from matches where id=current_setting('test.receipt_match')::uuid;
insert into public.blocks(blocker_id,blocked_id) values('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000502');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000502';
select public.mark_messages_delivered(current_setting('test.receipt_match')::uuid);
select public.mark_chat_read(current_setting('test.receipt_match')::uuid);
reset role;
do $$begin
  if exists(select 1 from messages where id='00000000-0000-4000-8000-000000000553' and (delivered_at is not null or read_at is not null)) then raise exception 'blocked message marked';end if;
end$$;
rollback;
\echo 'Receipt recipient/RLS/privacy/unread/epoch/block/idempotent-send checks passed'
