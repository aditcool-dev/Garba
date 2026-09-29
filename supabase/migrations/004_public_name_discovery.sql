-- Guests may see only first names. They cannot select the profiles table directly.
create or replace function public.get_public_profile_names()
returns table (id uuid, first_name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.first_name
  from public.profiles p
  where p.onboarding_complete = true
    and p.is_hidden = false
    and p.is_suspended = false
    and p.is_banned = false
  order by p.first_name;
$$;

revoke all on table public.profiles from anon;
grant execute on function public.get_public_profile_names() to anon, authenticated;
