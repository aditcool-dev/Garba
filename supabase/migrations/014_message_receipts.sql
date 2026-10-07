-- Apply after 013, before deploying the receipt-aware frontend. Idempotent.
begin;
alter table public.messages add column if not exists delivered_at timestamptz;
alter table public.profiles add column if not exists read_receipts_enabled boolean not null default true;
grant select(read_receipts_enabled) on public.profiles to authenticated;
create index if not exists messages_pending_receipts_idx on public.messages(match_id,chat_started_at,sender_id,created_at)
  where delivered_at is null or read_at is null;

-- Read-receipt opt-out must not leave the recipient's badge permanently unread.
-- This local seen state is private to the recipient and never published realtime.
create table if not exists public.message_seen_private(
  recipient_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key(recipient_id,message_id)
);
alter table public.message_seen_private enable row level security;
revoke all on public.message_seen_private from public,anon,authenticated;
grant all on public.message_seen_private to service_role;

-- Neither sender nor recipient may edit stored messages or manufacture receipts.
revoke insert,update,delete on public.messages from anon,authenticated;
grant insert(id,match_id,sender_id,body,created_at,chat_started_at) on public.messages to authenticated;
do $$declare policy record;begin
  for policy in select policyname from pg_policies where schemaname='public' and tablename='messages' and cmd in('UPDATE','DELETE','ALL') loop
    execute format('drop policy %I on public.messages',policy.policyname);
  end loop;
end$$;

create or replace function public.mark_messages_delivered(p_match_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); m public.matches;
begin
  select * into m from public.matches where id=p_match_id and actor in(user_a,user_b) for update;
  if actor is null or m.id is null or actor not in(m.user_a,m.user_b) then raise exception 'not a participant'; end if;
  if m.status<>'active' or exists(select 1 from public.blocks where (blocker_id=m.user_a and blocked_id=m.user_b) or (blocker_id=m.user_b and blocked_id=m.user_a))
    or exists(select 1 from public.profiles p where p.id in(m.user_a,m.user_b) and (p.is_sample or p.is_demo)) then return; end if;
  update public.messages msg set delivered_at=now()
    where msg.match_id=m.id and msg.sender_id=case when actor=m.user_a then m.user_b else m.user_a end
    and msg.chat_started_at=m.chat_started_at and msg.created_at>=m.chat_started_at and msg.delivered_at is null;
end$$;

-- The array overload marks only messages actually visible in the viewport.
create or replace function public.mark_chat_read(p_match_id uuid,p_message_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); m public.matches; receipts boolean;
begin
  select * into m from public.matches where id=p_match_id and actor in(user_a,user_b) for update;
  if actor is null or m.id is null or actor not in(m.user_a,m.user_b) then raise exception 'not a participant'; end if;
  if m.status<>'active' or exists(select 1 from public.blocks where (blocker_id=m.user_a and blocked_id=m.user_b) or (blocker_id=m.user_b and blocked_id=m.user_a))
    or exists(select 1 from public.profiles p where p.id in(m.user_a,m.user_b) and (p.is_sample or p.is_demo)) then return; end if;
  select p.read_receipts_enabled into receipts from public.profiles p where p.id=actor;
  insert into public.message_seen_private(recipient_id,message_id)
    select actor,msg.id from public.messages msg
    where msg.match_id=m.id and msg.sender_id=case when actor=m.user_a then m.user_b else m.user_a end
      and msg.chat_started_at=m.chat_started_at and msg.created_at>=m.chat_started_at
      and not receipts and (p_message_ids is null or msg.id=any(p_message_ids)) on conflict do nothing;
  update public.messages msg set delivered_at=coalesce(msg.delivered_at,now()),
    read_at=case when receipts then coalesce(msg.read_at,now()) else msg.read_at end
    where msg.match_id=m.id and msg.sender_id=case when actor=m.user_a then m.user_b else m.user_a end
      and msg.chat_started_at=m.chat_started_at and msg.created_at>=m.chat_started_at
      and (p_message_ids is null or msg.id=any(p_message_ids))
      and (msg.delivered_at is null or (receipts and msg.read_at is null));
  -- Only dismiss message notifications once no unseen current-epoch message remains.
  if not exists(select 1 from public.messages msg where msg.match_id=m.id and msg.sender_id<>actor
    and msg.chat_started_at=m.chat_started_at and msg.created_at>=m.chat_started_at and msg.read_at is null
    and not exists(select 1 from public.message_seen_private s where s.recipient_id=actor and s.message_id=msg.id)) then
    update public.notification_events set read_at=coalesce(read_at,now()) where recipient_id=actor and type='message' and match_id=m.id and read_at is null;
  end if;
end$$;
create or replace function public.mark_chat_read(p_match_id uuid)
returns void language sql security definer set search_path=public as $$ select public.mark_chat_read(p_match_id,null::uuid[]); $$;

create or replace function public.get_chat_unread_counts()
returns table(match_id uuid,unread_count bigint) language sql stable security definer set search_path=public as $$
select m.id,count(msg.id) from public.matches m left join public.messages msg on msg.match_id=m.id
  and msg.sender_id=case when auth.uid()=m.user_a then m.user_b else m.user_a end
  and msg.chat_started_at=m.chat_started_at and msg.created_at>=m.chat_started_at and msg.read_at is null
  and not exists(select 1 from public.message_seen_private s where s.recipient_id=auth.uid() and s.message_id=msg.id)
where m.status='active' and auth.uid() in(m.user_a,m.user_b)
  and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in(m.user_a,m.user_b))
group by m.id;
$$;
create or replace function public.get_user_notifications()
returns table(id text,user_id uuid,type text,title text,body text,sender_id uuid,sender_name text,sender_photo text,match_id uuid,created_at timestamptz,read boolean,unread_count bigint)
language sql stable security definer set search_path=public as $$
select 'message:'||m.id::text,auth.uid(),'message','Unread messages',count(*)::text||' unread message(s)',p.id,p.first_name,p.photo_path,m.id,max(msg.created_at),false,count(*)
from public.matches m join public.messages msg on msg.match_id=m.id join public.profiles p on p.id=case when m.user_a=auth.uid() then m.user_b else m.user_a end
where m.status='active' and auth.uid() in(m.user_a,m.user_b) and msg.sender_id<>auth.uid() and msg.read_at is null
  and msg.chat_started_at=m.chat_started_at and msg.created_at>=m.chat_started_at and not p.is_sample and not p.is_demo
  and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in(m.user_a,m.user_b))
  and not exists(select 1 from public.message_seen_private s where s.recipient_id=auth.uid() and s.message_id=msg.id)
group by m.id,p.id;
$$;

-- Stable client-generated UUID makes retry safe even if the INSERT succeeded
-- but its acknowledgement was lost. The match lock also serializes unmatch.
create or replace function public.send_chat_message(p_match_id uuid,p_message_id uuid,p_body text,p_chat_started_at timestamptz)
returns public.messages language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); m public.matches; msg public.messages;
begin
  select * into m from public.matches where id=p_match_id and actor in(user_a,user_b) for update;
  if actor is null or m.id is null or actor not in(m.user_a,m.user_b) or m.status<>'active' or p_chat_started_at is distinct from m.chat_started_at
    or exists(select 1 from public.blocks where (blocker_id=m.user_a and blocked_id=m.user_b) or (blocker_id=m.user_b and blocked_id=m.user_a)) then raise exception 'chat no longer available'; end if;
  if p_message_id is null or p_body is null or length(trim(p_body))=0 or length(p_body)>1000 then raise exception 'invalid message'; end if;
  select * into msg from public.messages where id=p_message_id;
  if msg.id is not null then
    if msg.match_id is distinct from m.id or msg.sender_id is distinct from actor or msg.body is distinct from p_body
      or msg.chat_started_at is distinct from m.chat_started_at or msg.created_at<m.chat_started_at then raise exception 'message identity conflict'; end if;
    return msg;
  end if;
  insert into public.messages(id,match_id,sender_id,body,chat_started_at) values(p_message_id,m.id,actor,p_body,m.chat_started_at) returning * into msg;
  return msg;
end$$;

revoke all on function public.mark_messages_delivered(uuid),public.mark_chat_read(uuid),public.mark_chat_read(uuid,uuid[]),public.get_chat_unread_counts(),public.send_chat_message(uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.mark_messages_delivered(uuid),public.mark_chat_read(uuid),public.mark_chat_read(uuid,uuid[]),public.get_chat_unread_counts(),public.send_chat_message(uuid,uuid,text,timestamptz) to authenticated;
alter table public.messages replica identity full;
do $$begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end$$;
notify pgrst,'reload schema';
commit;
