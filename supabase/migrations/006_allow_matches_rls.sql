-- Migration 006: Allow participants to insert and update mutual matches and view likes
-- Run this in your Supabase SQL Editor if you see RLS policy warnings on matches:

-- 1. Ensure matches table allows participants to insert and update active status
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
  using (user_a = auth.uid() or user_b = auth.uid());

-- 2. Ensure likes table allows participants to delete (e.g. on pass) and check reciprocals
drop policy if exists "likes delete" on public.likes;
create policy "likes delete" on public.likes
  for delete
  using (from_user = auth.uid());
