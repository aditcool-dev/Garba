-- Single idempotent health repair. Run after migrations 001–009.
-- Re-running repairs the contract without deleting any real user or conversation.
begin;
alter table public.profiles add column if not exists has_seen_discover_tutorial boolean not null default false;
alter table public.profiles add column if not exists is_sample boolean not null default false;
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.matches add column if not exists unmatched_at timestamptz;
alter table public.matches add column if not exists unmatched_by uuid references public.profiles(id);
alter table public.matches add column if not exists chat_started_at timestamptz;
update public.matches set chat_started_at=created_at where chat_started_at is null;
alter table public.matches alter column chat_started_at set default now();
alter table public.matches alter column chat_started_at set not null;
alter table public.messages add column if not exists chat_started_at timestamptz;
-- Backfill only conversations still on their original epoch. Null legacy rows
-- from already-reactivated conversations cannot be attributed safely and stay
-- evidence-only. Epoch equality prevents postdated old rows resurfacing later.
update public.messages msg set chat_started_at=m.chat_started_at from public.matches m
where msg.match_id=m.id and msg.chat_started_at is null and m.chat_started_at=m.created_at;
create index if not exists matches_status_idx on public.matches(status);
create index if not exists messages_match_epoch_idx on public.messages(match_id,chat_started_at,created_at);
create index if not exists profiles_sample_idx on public.profiles(is_sample);

-- Reassert the 008/009 RPC contracts as part of this one repair script.
create or replace function public.discovery_blocked_ids() returns setof uuid language sql stable security definer set search_path=public as $$
select case when blocker_id=auth.uid() then blocked_id else blocker_id end from public.blocks where auth.uid() is not null and auth.uid() in(blocker_id,blocked_id);
$$;
revoke all on function public.discovery_blocked_ids() from public,anon;
grant execute on function public.discovery_blocked_ids() to authenticated;
create or replace function public.unmatch_user(p_match_id uuid) returns uuid language plpgsql security definer set search_path=public as $$declare actor uuid:=auth.uid();m public.matches;a uuid;b uuid;begin
  select user_a,user_b into a,b from public.matches where id=p_match_id;
  if actor is null or a is null or actor not in(a,b) then raise exception 'not a match participant';end if;
  perform pg_advisory_xact_lock(hashtextextended(a::text||':'||b::text,0));
  select * into m from public.matches where id=p_match_id for update;
  if m.status='unmatched' then return m.id;end if;
  if m.status<>'active' then raise exception 'match is not active';end if;
  update public.matches set status='unmatched',unmatched_at=now(),unmatched_by=actor where id=m.id;
  delete from public.likes where (from_user=a and to_user=b) or (from_user=b and to_user=a);
  delete from public.passes where (from_user=a and to_user=b) or (from_user=b and to_user=a);
  return m.id;
end;$$;
revoke all on function public.unmatch_user(uuid) from public,anon;
grant execute on function public.unmatch_user(uuid) to authenticated;
create or replace function public.mark_discover_tutorial_seen() returns void language plpgsql security definer set search_path=public as $$begin
  if auth.uid() is null then raise exception 'authentication required';end if;
  update public.profiles set has_seen_discover_tutorial=true where id=auth.uid();
end;$$;
revoke all on function public.mark_discover_tutorial_seen() from public,anon;
grant execute on function public.mark_discover_tutorial_seen() to authenticated;
create or replace function public.discovery_overlap(a text[],b text[]) returns double precision language sql immutable set search_path=public as $$
select case when count(*)=0 then 0 else count(*) filter(where in_a and in_b)::double precision/count(*) end from
(select v,bool_or(side=1) in_a,bool_or(side=2) in_b from (select unnest(a) v,1 side union all select unnest(b) v,2 side) s group by v)t;
$$;
create or replace function public.report_chat_evidence(p_report_id uuid) returns setof public.messages language plpgsql security definer set search_path=public as $$declare r public.reports;begin
  if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'admin required';end if;
  select * into r from public.reports where id=p_report_id;
  return query select msg.* from public.messages msg join public.matches m on m.id=msg.match_id where m.user_a=least(r.reporter_id,r.reported_user_id) and m.user_b=greatest(r.reporter_id,r.reported_user_id) order by msg.created_at;
end;$$;
revoke all on function public.report_chat_evidence(uuid) from public,anon;
grant execute on function public.report_chat_evidence(uuid) to authenticated;

create table if not exists public.app_settings(key text primary key,value boolean not null);
insert into public.app_settings(key,value) values('SHOW_SAMPLE_PROFILES',true) on conflict(key) do nothing;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon,authenticated;
grant all on public.app_settings to service_role;
create or replace function public.samples_enabled() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select value from public.app_settings where key='SHOW_SAMPLE_PROFILES'),false)$$;
revoke all on function public.samples_enabled() from public,anon;
grant execute on function public.samples_enabled() to authenticated;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

-- Only the admin Auth API can supply raw_app_meta_data. Signup metadata is not trusted.
create or replace function public.assert_bmsce_email() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(new.raw_app_meta_data->>'is_sample','false')='true' and new.email ~ '^floor-[0-9]{2}@samples\.garbamate\.invalid$' then return new; end if;
  if lower(coalesce(new.email,'')) !~ '^[^@]+@bmsce\.ac\.in$' then raise exception 'Only bmsce.ac.in accounts may use GarbaMate'; end if;
  return new;
end;$$;
drop trigger if exists enforce_bmsce_email on auth.users;
create trigger enforce_bmsce_email before insert or update of email on auth.users for each row execute function public.assert_bmsce_email();
create or replace function public.sync_profile_trust() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set is_sample=coalesce(new.raw_app_meta_data->>'is_sample','false')='true',
    is_verified=new.email_confirmed_at is not null and lower(new.email) ~ '^[^@]+@bmsce\.ac\.in$' and coalesce(new.raw_app_meta_data->>'is_sample','false')<>'true' where id=new.id;
  return new;
end;$$;
drop trigger if exists sync_profile_trust on auth.users;
create trigger sync_profile_trust after insert or update of email,email_confirmed_at,raw_app_meta_data on auth.users for each row execute function public.sync_profile_trust();
update public.profiles p set is_sample=coalesce(u.raw_app_meta_data->>'is_sample','false')='true',
  is_verified=u.email_confirmed_at is not null and lower(u.email) ~ '^[^@]+@bmsce\.ac\.in$' and coalesce(u.raw_app_meta_data->>'is_sample','false')<>'true' from auth.users u where u.id=p.id;
create or replace function public.guard_profile_trust() returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from pg_roles where rolname=current_user and rolsuper) and current_user not in ('postgres','supabase_admin','supabase_auth_admin','service_role') and coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' is distinct from 'service_role' then
    if tg_op='INSERT' then
      if new.is_sample or new.is_verified or new.is_demo or new.is_suspended or new.is_banned then raise exception 'server-managed profile flags'; end if;
    elsif new.is_sample<>old.is_sample or new.is_verified<>old.is_verified or new.is_demo<>old.is_demo or ((new.is_suspended<>old.is_suspended or new.is_banned<>old.is_banned) and not public.is_admin()) then raise exception 'server-managed profile flags'; end if;
  end if;
  return new;
end;$$;
drop trigger if exists guard_profile_trust on public.profiles;
create trigger guard_profile_trust before insert or update on public.profiles for each row execute function public.guard_profile_trust();

-- Remove ALL existing policies, including allow_all_* copied by the former UI.
-- Replace with one explicit, auditable set. RLS remains enabled on every table.
do $$declare r record;begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','likes','passes','matches','messages','blocks','reports','admin_users','audit_log') loop
    execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
  for r in select tablename from pg_tables where schemaname='public' and tablename in ('profiles','likes','passes','matches','messages','blocks','reports','admin_users','audit_log') loop execute format('alter table public.%I enable row level security',r.tablename);end loop;
end;$$;
create policy "own profile read" on public.profiles for select to authenticated using(id=auth.uid() and not is_sample);
create policy "own profile insert" on public.profiles for insert to authenticated with check(id=auth.uid() and not is_sample and not is_demo and not is_verified);
create policy "own profile update" on public.profiles for update to authenticated using(id=auth.uid() and not is_sample) with check(id=auth.uid() and not is_sample);
create policy "safe discovery" on public.profiles for select to authenticated using(onboarding_complete and age>=18 and not is_hidden and not is_suspended and not is_banned and not is_demo and (not is_sample or public.samples_enabled()));
create policy "admin profile read" on public.profiles for select to authenticated using(not is_sample and not is_demo and public.is_admin());
create policy "admin moderation" on public.profiles for update to authenticated using(not is_sample and public.is_admin()) with check(not is_sample and public.is_admin());
create policy "likes select" on public.likes for select to authenticated using(from_user=auth.uid() or to_user=auth.uid());
create policy "likes insert" on public.likes for insert to authenticated with check(from_user=auth.uid());
create policy "likes update" on public.likes for update to authenticated using(from_user=auth.uid()) with check(from_user=auth.uid());
create policy "likes delete" on public.likes for delete to authenticated using(from_user=auth.uid() or to_user=auth.uid());
create policy "own passes" on public.passes for all to authenticated using(from_user=auth.uid()) with check(from_user=auth.uid());
create policy "own blocks" on public.blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid());
create policy "match participant select" on public.matches for select to authenticated using(auth.uid() in (user_a,user_b) and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in (user_a,user_b)));
create policy "message participant" on public.messages for select to authenticated using(exists(select 1 from public.matches m where m.id=match_id and m.status='active' and auth.uid() in (m.user_a,m.user_b) and messages.chat_started_at=m.chat_started_at and messages.created_at>=m.chat_started_at and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in (m.user_a,m.user_b))));
create policy "message sender" on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.matches m where m.id=match_id and m.status='active' and auth.uid() in (m.user_a,m.user_b) and messages.chat_started_at=m.chat_started_at and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in (m.user_a,m.user_b))));
create policy "own reports" on public.reports for insert to authenticated with check(reporter_id=auth.uid());
create policy "report read" on public.reports for select to authenticated using(reporter_id=auth.uid() or public.is_admin());
create policy "report review" on public.reports for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin membership" on public.admin_users for select to authenticated using(user_id=auth.uid());
create policy "admin audit" on public.audit_log for select to authenticated using(public.is_admin());

-- Hide internal sample/demo markers even in PostgREST select=* responses.
revoke select on public.profiles from anon,authenticated;
grant select(id,first_name,age,gender,branch,year,bio,experience,styles,looking_for,available_nights,interests,partner_preference,photo_path,is_hidden,is_suspended,is_banned,onboarding_complete,has_seen_discover_tutorial,is_verified,created_at,updated_at) on public.profiles to authenticated;
grant insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.likes,public.passes,public.blocks to authenticated;
grant select,insert on public.messages,public.reports to authenticated;
grant update on public.reports to authenticated;
grant select on public.matches,public.admin_users,public.audit_log to authenticated;
grant all on all tables in schema public to service_role;

create or replace function public.public_profile(p public.profiles) returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object('id',p.id,'first_name',p.first_name,'age',p.age,'gender',p.gender,'branch',p.branch,'year',p.year,'bio',p.bio,'experience',p.experience,
 'styles',p.styles,'looking_for',p.looking_for,'available_nights',p.available_nights,'interests',p.interests,'partner_preference',p.partner_preference,'photo_path',p.photo_path,
 'is_hidden',p.is_hidden,'is_suspended',p.is_suspended,'is_banned',p.is_banned,'onboarding_complete',p.onboarding_complete,'has_seen_discover_tutorial',p.has_seen_discover_tutorial,
 'is_verified',p.is_verified,'created_at',p.created_at,'updated_at',p.updated_at)
$$;
revoke all on function public.public_profile(public.profiles) from public,anon;
grant execute on function public.public_profile(public.profiles) to authenticated,service_role;
create or replace function public.get_admin_profiles() returns setof jsonb language plpgsql security definer set search_path=public as $$begin
  if not public.is_admin() then raise exception 'admin required';end if;
  return query select public.public_profile(p) from public.profiles p where not p.is_sample and not p.is_demo order by p.created_at desc;
end;$$;
revoke all on function public.get_admin_profiles() from public,anon;
grant execute on function public.get_admin_profiles() to authenticated;

create or replace function public.like_user(target uuid,kind public.like_kind default 'interested') returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();low uuid;high uuid;m public.matches;t public.profiles;a public.profiles;result_id uuid;
begin
  if actor is null or actor=target then raise exception 'invalid target';end if;
  low:=least(actor,target);high:=greatest(actor,target);perform pg_advisory_xact_lock(hashtextextended(low::text||':'||high::text,0));
  select * into a from public.profiles where id=actor; select * into t from public.profiles where id=target;
  if a.id is null or a.is_sample or a.is_demo or not a.is_verified or not a.onboarding_complete or a.is_hidden or a.is_suspended or a.is_banned or a.age<18 then raise exception 'account unavailable';end if;
  if t.id is null or t.is_demo or t.age<18 or not t.onboarding_complete or t.is_hidden or t.is_suspended or t.is_banned or (t.is_sample and not public.samples_enabled()) then raise exception 'target unavailable';end if;
  if exists(select 1 from public.blocks where (blocker_id=actor and blocked_id=target) or (blocker_id=target and blocked_id=actor)) then raise exception 'blocked';end if;
  if not ((a.partner_preference='Everyone' or (a.partner_preference='Women' and t.gender='Woman') or (a.partner_preference='Men' and t.gender='Man') or (a.partner_preference='Non-binary' and t.gender='Non-binary')) and (t.partner_preference='Everyone' or (t.partner_preference='Women' and a.gender='Woman') or (t.partner_preference='Men' and a.gender='Man') or (t.partner_preference='Non-binary' and a.gender='Non-binary'))) then raise exception 'preferences do not match';end if;
  insert into public.likes(from_user,to_user,kind) values(actor,target,kind) on conflict(from_user,to_user) do update set kind=excluded.kind;
  delete from public.passes where from_user=actor and to_user=target;
  if t.is_sample or not t.is_verified then return jsonb_build_object('matched',false,'match_id',null);end if;
  if not exists(select 1 from public.likes where from_user=target and to_user=actor) then return jsonb_build_object('matched',false,'match_id',null);end if;
  select * into m from public.matches where user_a=low and user_b=high for update;
  if m.id is null then insert into public.matches(user_a,user_b,status,chat_started_at) values(low,high,'active',clock_timestamp()) returning id into result_id;
  elsif m.status='unmatched' then update public.matches set status='active',unmatched_at=null,unmatched_by=null,chat_started_at=clock_timestamp() where id=m.id;result_id:=m.id;
  else result_id:=m.id;end if;
  return jsonb_build_object('matched',true,'match_id',result_id);
end;$$;
revoke all on function public.like_user(uuid,public.like_kind) from public,anon;
grant execute on function public.like_user(uuid,public.like_kind) to authenticated;
create or replace function public.guard_real_match() returns trigger language plpgsql security definer set search_path=public as $$begin
  if exists(select 1 from public.profiles where id in(new.user_a,new.user_b) and (is_sample or is_demo)) then raise exception 'samples cannot match';end if;return new;
end;$$;
drop trigger if exists guard_real_match on public.matches;
create trigger guard_real_match before insert or update on public.matches for each row execute function public.guard_real_match();

-- Epoch + row lock serializes sends against unmatch. Also rejects sample senders.
create or replace function public.guard_message_generation() returns trigger language plpgsql security definer set search_path=public as $$declare m public.matches;begin
  select * into m from public.matches where id=new.match_id for share;
  if auth.uid() is null or m.id is null or m.status<>'active' or auth.uid() not in(m.user_a,m.user_b) or new.sender_id<>auth.uid() then raise exception 'chat no longer available';end if;
  if new.chat_started_at is null or new.chat_started_at<>m.chat_started_at then raise exception 'chat generation changed';end if;
  if exists(select 1 from public.profiles where id in(m.user_a,m.user_b) and (is_sample or is_demo)) or exists(select 1 from public.blocks where (blocker_id=m.user_a and blocked_id=m.user_b) or (blocker_id=m.user_b and blocked_id=m.user_a)) then raise exception 'blocked or unavailable';end if;
  new.created_at:=clock_timestamp();return new;
end;$$;
drop trigger if exists message_generation on public.messages;
create trigger message_generation before insert on public.messages for each row execute function public.guard_message_generation();

-- Name-only guest API contains no IDs or internal flags.
drop function if exists public.get_public_profile_names();
create function public.get_public_profile_names() returns table(first_name text) language sql stable security definer set search_path=public as $$
select p.first_name from public.profiles p where p.onboarding_complete and p.age>=18 and not p.is_hidden and not p.is_suspended and not p.is_banned and not p.is_demo and (not p.is_sample or public.samples_enabled()) order by p.first_name;
$$;
revoke all on function public.get_public_profile_names() from public;
grant execute on function public.get_public_profile_names() to anon,authenticated;
create or replace function public.get_incoming_interests() returns table(id uuid,from_user uuid,to_user uuid,kind public.like_kind,created_at timestamptz,sender_first_name text,sender_photo_path text,sender_branch text,sender_year integer,sender_bio text,sender_styles text[],sender_available_nights smallint[])
language sql stable security definer set search_path=public as $$
select l.id,l.from_user,l.to_user,case when l.kind::text='garba_vibe' then 'garba_vibe'::public.like_kind else 'interested'::public.like_kind end,l.created_at,p.first_name,p.photo_path,p.branch,p.year,p.bio,p.styles,p.available_nights from public.likes l join public.profiles p on p.id=l.from_user
where l.to_user=auth.uid() and not p.is_sample and not p.is_demo and p.is_verified and not p.is_hidden and not p.is_suspended and not p.is_banned
and not exists(select 1 from public.matches m where m.status='active' and m.user_a=least(l.from_user,l.to_user) and m.user_b=greatest(l.from_user,l.to_user))
and not exists(select 1 from public.passes ps where ps.from_user=auth.uid() and ps.to_user=l.from_user)
and not exists(select 1 from public.blocks b where (b.blocker_id=l.from_user and b.blocked_id=l.to_user) or (b.blocker_id=l.to_user and b.blocked_id=l.from_user)) order by l.created_at desc;
$$;
revoke all on function public.get_incoming_interests() from public,anon;
grant execute on function public.get_incoming_interests() to authenticated;

create or replace function public.discover_feed(p_seed text,p_after_key double precision default null,p_after_id uuid default null,p_limit integer default 64) returns table(profile jsonb,rank_key double precision,score integer)
language plpgsql stable security definer set search_path=public as $$declare me public.profiles;begin
  if auth.uid() is null or p_seed is null or length(p_seed)<1 or length(p_seed)>200 then raise exception 'invalid feed session';end if;
  select * into me from public.profiles where id=auth.uid();
  if me.id is null or me.is_sample or me.is_demo or not me.is_verified or not me.onboarding_complete then return;end if;
  return query with candidates as (
    select p,round(100*(.30*public.discovery_overlap(me.available_nights::text[],p.available_nights::text[])
      +.20*case when 'Any'=any(me.styles) or 'Any'=any(p.styles) then 1 else public.discovery_overlap(me.styles,p.styles) end
      +.15*case when me.year=p.year then 1 when abs(me.year-p.year)=1 then .6 else .2 end
      +.15*case when me.branch=p.branch then 1 else .4 end
      +.10*public.discovery_overlap(me.interests,p.interests)
      +.10*case when 'Open to anything'=any(me.looking_for) or 'Open to anything'=any(p.looking_for) then 1 else public.discovery_overlap(me.looking_for,p.looking_for) end))::integer compatibility
    from public.profiles p where p.id<>me.id and p.age>=18 and p.onboarding_complete and not p.is_demo and not p.is_hidden and not p.is_suspended and not p.is_banned and (not p.is_sample or public.samples_enabled())
      and (me.partner_preference='Everyone' or (me.partner_preference='Women' and p.gender='Woman') or (me.partner_preference='Men' and p.gender='Man') or (me.partner_preference='Non-binary' and p.gender='Non-binary'))
      and (p.partner_preference='Everyone' or (p.partner_preference='Women' and me.gender='Woman') or (p.partner_preference='Men' and me.gender='Man') or (p.partner_preference='Non-binary' and me.gender='Non-binary'))
      and not exists(select 1 from public.blocks b where (b.blocker_id=me.id and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=me.id))
      and not exists(select 1 from public.likes l where l.from_user=me.id and l.to_user=p.id)
      and not exists(select 1 from public.passes ps where ps.from_user=me.id and ps.to_user=p.id)
      and not exists(select 1 from public.matches m where m.status='active' and m.user_a=least(me.id,p.id) and m.user_b=greatest(me.id,p.id))
  ), ranked as (select public.public_profile(c.p) p,(c.p).id id,
    -ln(((('x'||substr(md5(p_seed||':'||me.id::text||':'||(c.p).id::text),1,13))::bit(52)::bigint)::double precision+.5)/4503599627370496.0)/(.35+c.compatibility/100.0) k,c.compatibility s from candidates c)
  select r.p,r.k,r.s from ranked r where p_after_key is null or (r.k,r.id)>(p_after_key,p_after_id) order by r.k,r.id limit greatest(1,least(100,p_limit));
end;$$;
revoke all on function public.discover_feed(text,double precision,uuid,integer) from public,anon;
grant execute on function public.discover_feed(text,double precision,uuid,integer) to authenticated;

-- Notifications are derived from authorized real chats, never arbitrary broadcasts.
create or replace function public.mark_chat_read(p_match_id uuid) returns void language plpgsql security definer set search_path=public as $$declare m public.matches;begin
  select * into m from public.matches where id=p_match_id;
  if m.id is null or m.status<>'active' or auth.uid() not in(m.user_a,m.user_b) or exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in(m.user_a,m.user_b)) then raise exception 'chat unavailable';end if;
  update public.messages set read_at=clock_timestamp() where match_id=m.id and sender_id<>auth.uid() and chat_started_at=m.chat_started_at and created_at>=m.chat_started_at and read_at is null;
end;$$;
create or replace function public.mark_all_chats_read() returns void language plpgsql security definer set search_path=public as $$declare m record;begin
  if auth.uid() is null then raise exception 'authentication required';end if;
  for m in select id from public.matches where status='active' and auth.uid() in(user_a,user_b) and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in(user_a,user_b)) loop perform public.mark_chat_read(m.id);end loop;
end;$$;
drop function if exists public.get_user_notifications();
create function public.get_user_notifications() returns table(id text,user_id uuid,type text,title text,body text,sender_id uuid,sender_name text,sender_photo text,match_id uuid,created_at timestamptz,read boolean,unread_count bigint)
language sql stable security definer set search_path=public as $$
select 'message:'||m.id::text,auth.uid(),'message','Unread messages',count(*)::text||' unread message(s)',p.id,p.first_name,p.photo_path,m.id,max(msg.created_at),false,count(*)
from public.matches m join public.messages msg on msg.match_id=m.id join public.profiles p on p.id=case when m.user_a=auth.uid() then m.user_b else m.user_a end
where m.status='active' and auth.uid() in(m.user_a,m.user_b) and msg.sender_id<>auth.uid() and msg.read_at is null and msg.chat_started_at=m.chat_started_at and msg.created_at>=m.chat_started_at and not p.is_sample and not p.is_demo
and not exists(select 1 from public.discovery_blocked_ids() b(id) where b.id in(m.user_a,m.user_b)) group by m.id,p.id;
$$;
revoke all on function public.mark_chat_read(uuid),public.mark_all_chats_read(),public.get_user_notifications() from public,anon;
grant execute on function public.mark_chat_read(uuid),public.mark_all_chats_read(),public.get_user_notifications() to authenticated;

-- Ensure both positions of the pair, messages, and incoming interests can update.
do $$declare t text;begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['matches','messages','likes'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
    end loop;
  end if;
end;$$;
notify pgrst,'reload schema';
commit;
