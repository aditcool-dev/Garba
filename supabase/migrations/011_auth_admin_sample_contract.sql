-- GoTrue's Admin createUser inserts auth.users before applying app_metadata.
-- Therefore the sample marker is not available to a BEFORE INSERT trigger.
-- This migration permits only the reserved sample-address shape at insert,
-- immediately bans an unmarked reserved account, and accepts the marker only
-- on that reserved address. Real public signups remain BMSCE-only.
begin;

create or replace function public.is_reserved_sample_email(value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(value, ''))) ~ '^floor-(0[1-9]|[12][0-9]|30)@samples\.garbamate\.invalid$';
$$;
revoke all on function public.is_reserved_sample_email(text) from public, anon, authenticated;

create or replace function public.assert_bmsce_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  marked_sample boolean := coalesce(new.raw_app_meta_data->>'is_sample', 'false') = 'true';
begin
  if public.is_reserved_sample_email(normalized_email) then
    return new;
  end if;
  if marked_sample then
    raise exception 'Sample accounts require a reserved sample address';
  end if;
  if normalized_email !~ '^[^@]+@bmsce\.ac\.in$' then
    raise exception 'Only bmsce.ac.in accounts may use GarbaMate';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_bmsce_email on auth.users;
create trigger enforce_bmsce_email
  before insert or update of email, raw_app_meta_data on auth.users
  for each row execute function public.assert_bmsce_email();

create or replace function public.enforce_reserved_sample_account()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  marked_sample boolean := coalesce(new.raw_app_meta_data->>'is_sample', 'false') = 'true';
begin
  if public.is_reserved_sample_email(normalized_email) and not marked_sample then
    -- Admin createUser reaches this trigger before its later app_metadata
    -- update. Banning is safe for that temporary state and remains safe after
    -- the trusted marker arrives. A public signup can never become usable.
    update auth.users
       set banned_until = '9999-12-31 23:59:59+00'::timestamptz
     where id = new.id
       and (banned_until is null or banned_until < '9999-12-31 23:59:59+00'::timestamptz);
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_reserved_sample_account on auth.users;
create trigger enforce_reserved_sample_account
  after insert or update of email, raw_app_meta_data on auth.users
  for each row execute function public.enforce_reserved_sample_account();

commit;
