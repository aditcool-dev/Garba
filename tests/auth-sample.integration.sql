\set ON_ERROR_STOP on
-- Disposable PostgreSQL contract test for the real GoTrue Admin ordering:
-- INSERT with provider metadata, followed by UPDATE of app_metadata.
begin;
insert into auth.users(id,email,raw_app_meta_data,email_confirmed_at)
values('00000000-0000-4000-8000-000000000206','floor-02@samples.garbamate.invalid','{"provider":"email"}',now());
do $$begin
  if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000206' and banned_until is not null) then raise exception 'unmarked reserved account was not banned';end if;
end$$;
update auth.users set raw_app_meta_data='{"provider":"email","is_sample":true}' where id='00000000-0000-4000-8000-000000000206';
do $$begin
  if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000206' and raw_app_meta_data->>'is_sample'='true' and banned_until is not null) then raise exception 'sample marker or ban missing';end if;
end$$;

do $$begin
  begin insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000207','floor-03@samples.garbamate.invalid','{"is_sample":true}');
  exception when others then raise exception 'reserved public signup must be contained, got %',sqlerrm;
  end;
  if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000207' and banned_until is not null) then raise exception 'reserved public signup was usable';end if;
  begin insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000208','attacker@example.com');raise exception 'non-college signup accepted';
  exception when others then if sqlerrm='non-college signup accepted' then raise;end if;end;
  begin insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000209','student@bmsce.ac.in','{"is_sample":true}');raise exception 'sample marker accepted on college address';
  exception when others then if sqlerrm='sample marker accepted on college address' then raise;end if;end;
  insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000210','student2@bmsce.ac.in');
end$$;
rollback;
\echo 'Auth Admin sample ordering, reserved signup containment, BMSCE rule and real college signup checks passed'
