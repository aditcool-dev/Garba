begin;

alter table public.profiles add column if not exists has_seen_discover_tutorial boolean not null default false;
alter table public.matches add column if not exists unmatched_at timestamptz;
alter table public.matches add column if not exists unmatched_by uuid references public.profiles(id);
alter table public.matches add column if not exists chat_started_at timestamptz;
update public.matches set chat_started_at = created_at where chat_started_at is null;
alter table public.matches alter column chat_started_at set default now();
alter table public.matches alter column chat_started_at set not null;
create index if not exists matches_status_idx on public.matches(status);

-- Only RPCs may create/reactivate/unmatch a match. Older participant-write
-- policies allowed bypassing mutual likes and resetting the chat generation.
drop policy if exists "match participant insert" on public.matches;
drop policy if exists "match participant update" on public.matches;

create or replace function public.unmatch_user(p_match_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); m public.matches; a uuid; b uuid;
begin
  select user_a,user_b into a,b from public.matches where id=p_match_id;
  if actor is null or a is null or actor not in (a,b) then raise exception 'not a match participant'; end if;
  -- The same pair lock is used by like_user, including before a row exists.
  perform pg_advisory_xact_lock(hashtextextended(a::text || ':' || b::text,0));
  select * into m from public.matches where id=p_match_id for update;
  -- A participant repeating the already-confirmed operation is a safe no-op.
  if m.status='unmatched' then return m.id; end if;
  if m.status<>'active' then raise exception 'match is not active'; end if;
  update public.matches set status='unmatched',unmatched_at=now(),unmatched_by=actor where id=m.id;
  delete from public.likes where (from_user=a and to_user=b) or (from_user=b and to_user=a);
  delete from public.passes where (from_user=a and to_user=b) or (from_user=b and to_user=a);
  return m.id;
end; $$;
revoke all on function public.unmatch_user(uuid) from public,anon;
grant execute on function public.unmatch_user(uuid) to authenticated;

create or replace function public.like_user(target uuid, kind like_kind default 'interested')
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); low uuid; high uuid; m public.matches; result_id uuid;
begin
  if actor is null or actor=target then raise exception 'invalid target'; end if;
  low:=least(actor,target); high:=greatest(actor,target);
  perform pg_advisory_xact_lock(hashtextextended(low::text || ':' || high::text,0));
  if exists(select 1 from public.blocks where (blocker_id=actor and blocked_id=target) or (blocker_id=target and blocked_id=actor)) then raise exception 'blocked'; end if;
  insert into public.likes(from_user,to_user,kind) values(actor,target,kind)
    on conflict(from_user,to_user) do update set kind=excluded.kind;
  delete from public.passes where from_user=actor and to_user=target;
  if not exists(select 1 from public.likes where from_user=target and to_user=actor) then
    return jsonb_build_object('matched',false,'match_id',null);
  end if;
  select * into m from public.matches where user_a=low and user_b=high for update;
  if m.id is null then
    insert into public.matches(user_a,user_b,status,chat_started_at) values(low,high,'active',clock_timestamp()) returning id into result_id;
  elsif m.status='unmatched' then
    update public.matches set status='active',unmatched_at=null,unmatched_by=null,chat_started_at=clock_timestamp() where id=m.id;
    result_id:=m.id;
  else result_id:=m.id;
  end if;
  return jsonb_build_object('matched',true,'match_id',result_id);
end; $$;
revoke all on function public.like_user(uuid,like_kind) from public,anon;
grant execute on function public.like_user(uuid,like_kind) to authenticated;

-- Return only the pair's exclusion, not the other person's private block rows.
-- Message RLS must use this helper: querying blocks directly under the reader's
-- role cannot see a block created by the other participant.
create or replace function public.discovery_blocked_ids() returns setof uuid
language sql stable security definer set search_path=public as $$
  select case when blocker_id=auth.uid() then blocked_id else blocker_id end from public.blocks
    where auth.uid() is not null and auth.uid() in (blocker_id,blocked_id);
$$;
revoke all on function public.discovery_blocked_ids() from public,anon;
grant execute on function public.discovery_blocked_ids() to authenticated;

drop policy if exists "message participant" on public.messages;
drop policy if exists "message sender" on public.messages;
drop policy if exists "message sender in active match" on public.messages;
create policy "message participant" on public.messages for select using (
  exists(select 1 from public.matches m where m.id=match_id and m.status='active'
    and messages.created_at>=m.chat_started_at and auth.uid() in (m.user_a,m.user_b)
    and not exists(select 1 from public.discovery_blocked_ids() b(profile_id) where b.profile_id in (m.user_a,m.user_b)))
);
create policy "message sender in active match" on public.messages for insert with check (
  sender_id=auth.uid() and exists(select 1 from public.matches m where m.id=match_id and m.status='active'
    and messages.created_at>=m.chat_started_at and auth.uid() in (m.user_a,m.user_b)
    and not exists(select 1 from public.discovery_blocked_ids() b(profile_id) where b.profile_id in (m.user_a,m.user_b)))
);

-- Serialize in-flight sends with unmatch and stamp server time. Old-generation
-- clients must supply the generation they opened, so delayed sends cannot enter
-- a reactivated conversation.
alter table public.messages add column if not exists chat_started_at timestamptz;
create or replace function public.guard_message_generation() returns trigger
language plpgsql security definer set search_path=public as $$
declare m public.matches;
begin
  select * into m from public.matches where id=new.match_id for share;
  if auth.uid() is null or m.id is null or m.status<>'active' or auth.uid() not in (m.user_a,m.user_b)
    or new.sender_id<>auth.uid() then raise exception 'chat no longer available'; end if;
  if new.chat_started_at is null or new.chat_started_at<>m.chat_started_at then raise exception 'chat generation changed'; end if;
  if exists(select 1 from public.blocks where (blocker_id=m.user_a and blocked_id=m.user_b) or (blocker_id=m.user_b and blocked_id=m.user_a)) then raise exception 'blocked'; end if;
  new.created_at:=clock_timestamp();
  return new;
end; $$;
drop trigger if exists message_generation on public.messages;
create trigger message_generation before insert on public.messages for each row execute function public.guard_message_generation();

-- Reports and messages are retained. Only an existing admin may review evidence
-- for a reported pair; ordinary participants still cannot read old messages.
create or replace function public.report_chat_evidence(p_report_id uuid)
returns setof public.messages language plpgsql security definer set search_path=public as $$
declare r public.reports;
begin
  if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'admin required'; end if;
  select * into r from public.reports where id=p_report_id;
  return query select msg.* from public.messages msg join public.matches m on m.id=msg.match_id
    where m.user_a=least(r.reporter_id,r.reported_user_id) and m.user_b=greatest(r.reporter_id,r.reported_user_id) order by msg.created_at;
end; $$;
revoke all on function public.report_chat_evidence(uuid) from public,anon;
grant execute on function public.report_chat_evidence(uuid) to authenticated;
drop policy if exists "admin report review" on public.reports;
create policy "admin report review" on public.reports for select using (
  exists(select 1 from public.admin_users where user_id=auth.uid())
);

-- The existing own-profile UPDATE policy already restricts the tutorial flag to
-- the owner; no broader profile-write policy is introduced.
create or replace function public.mark_discover_tutorial_seen() returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.profiles set has_seen_discover_tutorial=true where id=auth.uid();
end; $$;
revoke all on function public.mark_discover_tutorial_seen() from public,anon;
grant execute on function public.mark_discover_tutorial_seen() to authenticated;

-- Incoming RPC previously excluded every historical match, including unmatched.
create or replace function public.get_incoming_interests()
returns table(id uuid,from_user uuid,to_user uuid,kind like_kind,created_at timestamptz,
 sender_first_name text,sender_photo_path text,sender_branch text,sender_year integer,sender_bio text,sender_styles text[],sender_available_nights smallint[])
language sql security definer set search_path=public as $$
select l.id,l.from_user,l.to_user,l.kind,l.created_at,p.first_name,p.photo_path,p.branch,p.year,p.bio,p.styles,p.available_nights
from public.likes l join public.profiles p on p.id=l.from_user
where l.to_user=auth.uid()
 and not exists(select 1 from public.matches m where m.status='active' and m.user_a=least(l.from_user,l.to_user) and m.user_b=greatest(l.from_user,l.to_user))
 and not exists(select 1 from public.passes ps where ps.from_user=auth.uid() and ps.to_user=l.from_user)
 and not exists(select 1 from public.blocks b where (b.blocker_id=l.from_user and b.blocked_id=l.to_user) or (b.blocker_id=l.to_user and b.blocked_id=l.from_user))
order by l.created_at desc;
$$;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
commit;
