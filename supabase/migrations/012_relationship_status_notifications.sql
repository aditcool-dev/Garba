-- Authoritative relationship status and notification contract.
-- Safe to rerun after migrations 001-011.
begin;

create table if not exists public.notification_events(
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  type text not null check(type in ('interest','match','message','unmatch')),
  match_id uuid references public.matches(id) on delete cascade,
  like_kind public.like_kind,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists notification_interest_once on public.notification_events(recipient_id,actor_id,type) where type='interest';
create unique index if not exists notification_match_once on public.notification_events(recipient_id,match_id,type) where type='match';
create index if not exists notification_recipient_created on public.notification_events(recipient_id,created_at desc);
create index if not exists likes_from_user_idx on public.likes(from_user);
create index if not exists likes_to_user_idx on public.likes(to_user);
create index if not exists passes_from_user_idx on public.passes(from_user);
alter table public.notification_events enable row level security;
drop policy if exists "notification owner read" on public.notification_events;
create policy "notification owner read" on public.notification_events for select to authenticated using(recipient_id=auth.uid());
drop policy if exists "notification owner update" on public.notification_events;
create policy "notification owner update" on public.notification_events for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
revoke all on public.notification_events from anon,authenticated;
grant select,update on public.notification_events to authenticated;

create or replace function public.relationship_status(p_actor uuid,p_target uuid)
returns text language sql stable security definer set search_path=public as $$
select case
  when exists(select 1 from matches m where m.status='active' and m.user_a=least(p_actor,p_target) and m.user_b=greatest(p_actor,p_target)) then 'matched'
  when exists(select 1 from likes l where l.from_user=p_actor and l.to_user=p_target) then 'sent'
  when exists(select 1 from passes x where x.from_user=p_actor and x.to_user=p_target) then 'passed'
  when exists(select 1 from likes l where l.from_user=p_target and l.to_user=p_actor) then 'incoming'
  else 'new' end;
$$;
revoke all on function public.relationship_status(uuid,uuid) from public,anon;

create or replace function public.discover_relationships()
returns table(profile jsonb,status text,like_kind public.like_kind,match_id uuid,overlap_nights integer)
language sql stable security definer set search_path=public as $$
select public.public_profile(p), public.relationship_status(auth.uid(),p.id), own.kind,
  (select m.id from matches m where m.status='active' and m.user_a=least(auth.uid(),p.id) and m.user_b=greatest(auth.uid(),p.id)),
  (select count(*)::integer from unnest(coalesce(p.available_nights,'{}'::smallint[])) n where n=any(coalesce(me.available_nights,'{}'::smallint[])))
from profiles p join profiles me on me.id=auth.uid()
left join lateral (select l.kind from likes l where l.from_user=auth.uid() and l.to_user=p.id limit 1) own on true
where p.id<>auth.uid() and p.onboarding_complete and p.age>=18 and not p.is_hidden and not p.is_suspended and not p.is_banned and not p.is_demo
  and (not p.is_sample or public.samples_enabled())
  and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id=p.id)
  and (me.partner_preference='Everyone' or (me.partner_preference='Women' and p.gender='Woman') or (me.partner_preference='Men' and p.gender='Man') or (me.partner_preference='Non-binary' and p.gender='Non-binary'))
  and (p.partner_preference='Everyone' or (p.partner_preference='Women' and me.gender='Woman') or (p.partner_preference='Men' and me.gender='Man') or (p.partner_preference='Non-binary' and me.gender='Non-binary'))
order by p.first_name;
$$;
revoke all on function public.discover_relationships() from public,anon;
grant execute on function public.discover_relationships() to authenticated;

create or replace function public.set_decision(p_target uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); a profiles; t profiles; low uuid; high uuid; m matches; match_id uuid; kind like_kind; result_status text;
begin
  if actor is null or actor=p_target or p_decision not in('interested','vibe','pass','clear') then raise exception 'invalid decision'; end if;
  select * into a from profiles where id=actor; select * into t from profiles where id=p_target;
  if a.id is null or t.id is null or not a.is_verified or a.is_sample or a.is_demo or not a.onboarding_complete then raise exception 'account unavailable'; end if;
  if t.is_hidden or t.is_suspended or t.is_banned or t.is_demo or (t.is_sample and not public.samples_enabled()) then raise exception 'target unavailable'; end if;
  if exists(select 1 from blocks where (blocker_id=actor and blocked_id=p_target) or (blocker_id=p_target and blocked_id=actor)) then raise exception 'blocked'; end if;
  if not ((a.partner_preference='Everyone' or (a.partner_preference='Women' and t.gender='Woman') or (a.partner_preference='Men' and t.gender='Man') or (a.partner_preference='Non-binary' and t.gender='Non-binary')) and (t.partner_preference='Everyone' or (t.partner_preference='Women' and a.gender='Woman') or (t.partner_preference='Men' and a.gender='Man') or (t.partner_preference='Non-binary' and a.gender='Non-binary'))) then raise exception 'preferences do not match'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(actor,p_target)::text||':'||greatest(actor,p_target)::text,0));
  if p_decision='clear' then
    delete from passes where from_user=actor and to_user=p_target;
    delete from likes where from_user=actor and to_user=p_target;
  elsif p_decision='pass' then
    delete from likes where from_user=actor and to_user=p_target;
    insert into passes(from_user,to_user) values(actor,p_target) on conflict(from_user,to_user) do update set created_at=clock_timestamp();
    delete from notification_events where type='interest' and ((recipient_id=p_target and actor_id=actor) or (recipient_id=actor and actor_id=p_target));
  else
    if p_decision='vibe' then
      if (select count(*) from public.likes l where l.from_user=actor and l.kind='garba_vibe' and l.created_at>=date_trunc('day',clock_timestamp()))>=3 then raise exception 'daily Garba Vibe quota reached'; end if;
      kind:='garba_vibe';
    else kind:='interested'; end if;
    delete from passes where from_user=actor and to_user=p_target;
    insert into likes(from_user,to_user,kind) values(actor,p_target,kind) on conflict(from_user,to_user) do update set kind=excluded.kind,created_at=clock_timestamp();
    if t.is_sample then result_status:='sent';
    elsif exists(select 1 from likes where from_user=p_target and to_user=actor) then
      low:=least(actor,p_target); high:=greatest(actor,p_target);
      select * into m from matches where user_a=low and user_b=high for update;
      if m.id is null then insert into matches(user_a,user_b,status,chat_started_at) values(low,high,'active',clock_timestamp()) returning id into match_id;
      elsif m.status='unmatched' then update matches set status='active',unmatched_at=null,unmatched_by=null,chat_started_at=clock_timestamp() where id=m.id returning id into match_id;
      else match_id:=m.id; end if;
      delete from notification_events where type='interest' and ((recipient_id=actor and actor_id=p_target) or (recipient_id=p_target and actor_id=actor));
      insert into notification_events(recipient_id,actor_id,type,match_id,body) values(actor,p_target,'match',match_id,'It''s a Garba Match!'),(p_target,actor,'match',match_id,'It''s a Garba Match!') on conflict do nothing;
      result_status:='matched';
    else
      insert into notification_events(recipient_id,actor_id,type,like_kind,body) values(p_target,actor,'interest',kind,'Someone is interested in you') on conflict do nothing;
      result_status:='sent';
    end if;
  end if;
  if result_status is null then result_status:=public.relationship_status(actor,p_target); end if;
  return jsonb_build_object('status',result_status,'match_id',match_id);
end;
$$;
revoke all on function public.set_decision(uuid,text) from public,anon;
grant execute on function public.set_decision(uuid,text) to authenticated;

create or replace function public.get_relationship_notifications()
returns table(id uuid,type text,actor_id uuid,match_id uuid,like_kind public.like_kind,created_at timestamptz,read boolean,sender_first_name text,sender_photo_path text,sender_branch text,sender_year integer,overlap_nights integer,unread_count bigint)
language sql stable security definer set search_path=public as $$
select n.id,n.type,n.actor_id,n.match_id,n.like_kind,n.created_at,n.read_at is not null,p.first_name,p.photo_path,p.branch,p.year,
  (select count(*)::integer from unnest(coalesce(p.available_nights,'{}'::smallint[])) x where x=any(coalesce(me.available_nights,'{}'::smallint[]))),
  (select count(*) from notification_events q where q.recipient_id=auth.uid() and q.read_at is null)
from notification_events n left join profiles p on p.id=n.actor_id join profiles me on me.id=auth.uid()
where n.recipient_id=auth.uid() and (n.type<>'interest' or exists(select 1 from likes l where l.from_user=n.actor_id and l.to_user=auth.uid()))
order by n.created_at desc;
$$;
revoke all on function public.get_relationship_notifications() from public,anon;
grant execute on function public.get_relationship_notifications() to authenticated;

create or replace function public.mark_relationship_notification(p_id uuid default null)
returns void language sql security definer set search_path=public as $$ update notification_events set read_at=clock_timestamp() where recipient_id=auth.uid() and (p_id is null or id=p_id); $$;
revoke all on function public.mark_relationship_notification(uuid) from public,anon;
grant execute on function public.mark_relationship_notification(uuid) to authenticated;

create or replace function public.mark_chat_read(p_match_id uuid) returns void language plpgsql security definer set search_path=public as $$declare m matches;begin
  select * into m from matches where id=p_match_id;
  if m.id is null or m.status<>'active' or auth.uid() not in(m.user_a,m.user_b) then raise exception 'chat unavailable'; end if;
  update messages set read_at=clock_timestamp() where match_id=m.id and sender_id<>auth.uid() and chat_started_at=m.chat_started_at and created_at>=m.chat_started_at and read_at is null;
  update notification_events set read_at=clock_timestamp() where recipient_id=auth.uid() and type='message' and match_id=m.id and read_at is null;
end;$$;
revoke all on function public.mark_chat_read(uuid) from public,anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

create or replace function public.mark_all_relationship_notifications()
returns void language sql security definer set search_path=public as $$ update notification_events set read_at=clock_timestamp() where recipient_id=auth.uid() and read_at is null; $$;
revoke all on function public.mark_all_relationship_notifications() from public,anon;
grant execute on function public.mark_all_relationship_notifications() to authenticated;

create or replace function public.notify_relationship_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid;
begin
  select case when user_a=new.sender_id then user_b else user_a end into recipient from matches where id=new.match_id and status='active';
  if recipient is not null then
    insert into notification_events(recipient_id,actor_id,type,match_id,body) values(recipient,new.sender_id,'message',new.match_id,'You have a new message');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_relationship_message on public.messages;
create trigger notify_relationship_message after insert on public.messages for each row execute function public.notify_relationship_message();

create or replace function public.notify_relationship_unmatch()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status='active' and new.status='unmatched' then
    insert into notification_events(recipient_id,actor_id,type,match_id,body) values
      (new.user_a,new.user_b,'unmatch',new.id,'This match is no longer active'),
      (new.user_b,new.user_a,'unmatch',new.id,'This match is no longer active');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_relationship_unmatch on public.matches;
create trigger notify_relationship_unmatch after update of status on public.matches for each row execute function public.notify_relationship_unmatch();

do $$begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification_events') then
    alter publication supabase_realtime add table public.notification_events;
  end if;
exception when undefined_object then null;
end$$;
commit;
