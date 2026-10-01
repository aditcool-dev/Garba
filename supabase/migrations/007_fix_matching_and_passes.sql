-- Migration 007: Comprehensive RLS and RPC fixes for mutual matches, incoming interests, likes, and passes
-- Run this in your Supabase SQL Editor to ensure all cross-device operations succeed with zero RLS blocks.

-- 1. LIKES TABLE: Full permissions for sender and recipient
drop policy if exists "own likes" on public.likes;
drop policy if exists "likes participant" on public.likes;
drop policy if exists "likes insert" on public.likes;
drop policy if exists "likes update" on public.likes;
drop policy if exists "likes delete" on public.likes;

-- Senders and recipients can view likes involving them
create policy "likes select" on public.likes
  for select
  using (from_user = auth.uid() or to_user = auth.uid());

-- Authenticated users can insert their outgoing likes
create policy "likes insert" on public.likes
  for insert
  with check (from_user = auth.uid());

-- Senders can update their own likes
create policy "likes update" on public.likes
  for update
  using (from_user = auth.uid())
  with check (from_user = auth.uid());

-- Either the sender can cancel OR the recipient can dismiss/pass an incoming like
create policy "likes delete" on public.likes
  for delete
  using (from_user = auth.uid() or to_user = auth.uid());

-- 2. MATCHES TABLE: Full permissions for participants
drop policy if exists "match participant" on public.matches;
drop policy if exists "match participant select" on public.matches;
drop policy if exists "match participant insert" on public.matches;
drop policy if exists "match participant update" on public.matches;

create policy "match participant select" on public.matches
  for select
  using (user_a = auth.uid() or user_b = auth.uid());

create policy "match participant insert" on public.matches
  for insert
  with check (user_a = auth.uid() or user_b = auth.uid());

create policy "match participant update" on public.matches
  for update
  using (user_a = auth.uid() or user_b = auth.uid())
  with check (user_a = auth.uid() or user_b = auth.uid());

-- 3. PASSES TABLE: Full permissions for pass creator
drop policy if exists "own passes" on public.passes;
drop policy if exists "passes select" on public.passes;
drop policy if exists "passes insert" on public.passes;
drop policy if exists "passes delete" on public.passes;

create policy "passes select" on public.passes
  for select
  using (from_user = auth.uid());

create policy "passes insert" on public.passes
  for insert
  with check (from_user = auth.uid());

create policy "passes delete" on public.passes
  for delete
  using (from_user = auth.uid());

-- 4. Atomic like_user function with security definer
create or replace function public.like_user(target uuid, kind like_kind default 'interested')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid := auth.uid();
  low uuid;
  high uuid;
  found_match_id uuid;
begin
  if a is null or a = target then
    return jsonb_build_object('matched', false, 'error', 'invalid_target');
  end if;

  -- Insert outgoing like
  insert into public.likes(from_user, to_user, kind)
  values (a, target, kind)
  on conflict (from_user, to_user) do update set kind = excluded.kind;

  -- Delete any lingering pass between these users
  delete from public.passes where (from_user = a and to_user = target) or (from_user = target and to_user = a);

  -- Check if reciprocal like exists
  if exists (select 1 from public.likes where from_user = target and to_user = a) then
    low := least(a, target);
    high := greatest(a, target);

    insert into public.matches (user_a, user_b, status)
    values (low, high, 'active')
    on conflict (user_a, user_b) do update set status = 'active'
    returning id into found_match_id;

    return jsonb_build_object('matched', true, 'match_id', found_match_id);
  end if;

  return jsonb_build_object('matched', false, 'match_id', null);
end;
$$;

grant execute on function public.like_user(uuid, like_kind) to authenticated;

-- 5. Incoming interests query function
create or replace function public.get_incoming_interests()
returns table (
  id uuid,
  from_user uuid,
  to_user uuid,
  kind like_kind,
  created_at timestamptz,
  sender_first_name text,
  sender_photo_path text,
  sender_branch text,
  sender_year integer,
  sender_bio text,
  sender_styles text[],
  sender_available_nights smallint[]
)
language sql
security definer
set search_path = public
as $$
  select 
    l.id,
    l.from_user,
    l.to_user,
    l.kind,
    l.created_at,
    p.first_name as sender_first_name,
    p.photo_path as sender_photo_path,
    p.branch as sender_branch,
    p.year as sender_year,
    p.bio as sender_bio,
    p.styles as sender_styles,
    p.available_nights as sender_available_nights
  from public.likes l
  join public.profiles p on p.id = l.from_user
  where l.to_user = auth.uid()
    and not exists (
      select 1 from public.matches m 
      where (m.user_a = auth.uid() and m.user_b = l.from_user)
         or (m.user_b = auth.uid() and m.user_a = l.from_user)
    )
    and not exists (
      select 1 from public.passes ps
      where ps.from_user = auth.uid() and ps.to_user = l.from_user
    )
  order by l.created_at desc;
$$;

grant execute on function public.get_incoming_interests() to authenticated;
