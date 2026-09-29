-- Apply this migration in the Supabase SQL Editor after 001_init.sql.
-- The client cannot enforce OAuth domain or profile creation safely by itself.

create or replace function public.assert_bmsce_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  email_domain text := substring(normalized_email from '@([^@]+)$');
begin
  if email_domain is null or email_domain <> 'bmsce.ac.in' then
    raise exception 'Only verified bmsce.ac.in accounts may use GarbaMate';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_bmsce_email on auth.users;
create trigger enforce_bmsce_email
  before insert or update of email on auth.users
  for each row execute function public.assert_bmsce_email();

-- Keep the profile row in sync for Google OAuth, password signup, and magic links.
-- The profile remains incomplete until the user finishes onboarding.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text := coalesce(
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );
begin
  insert into public.profiles (
    id, first_name, age, gender, branch, year, bio, experience,
    styles, looking_for, available_nights, interests, partner_preference,
    photo_path, is_hidden, is_suspended, is_banned, onboarding_complete, is_demo
  ) values (
    new.id, left(display_name, 40), 18, 'Prefer not to say'::gender_label,
    'CSE', 1, '', 'Beginner', '{}', '{}', '{}', '{}', 'Everyone',
    null, false, false, false, false, false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
