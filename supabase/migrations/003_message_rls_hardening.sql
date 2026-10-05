-- Messages must belong to an active, unblocked match. The client cannot bypass this.
drop policy if exists "message sender" on public.messages;
drop policy if exists "message sender in active match" on public.messages;
create policy "message sender in active match" on public.messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.status = 'active'
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = m.user_a and b.blocked_id = m.user_b)
           or (b.blocker_id = m.user_b and b.blocked_id = m.user_a)
      )
  )
);
