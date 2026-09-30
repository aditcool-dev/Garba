-- Migration 005: Allow recipients to view incoming likes and add high-speed RPC
-- Run this in your Supabase SQL Editor:

-- 1. Fix RLS on likes table so to_user can see who liked them
drop policy if exists "own likes" on public.likes;
drop policy if exists "likes participant" on public.likes;

create policy "likes participant" on public.likes
for select
using (from_user = auth.uid() or to_user = auth.uid());

create policy "likes insert" on public.likes
for insert
with check (from_user = auth.uid());

create policy "likes update" on public.likes
for update
using (from_user = auth.uid());

create policy "likes delete" on public.likes
for delete
using (from_user = auth.uid());

-- 2. Fast, secure RPC to fetch incoming interests with sender profiles
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
