\set ON_ERROR_STOP on
-- Disposable database only. Exercises the authoritative status and decision RPC.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000401','status-a@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000402','status-b@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000403','status-c@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000404','status-d@bmsce.ac.in',now()),
 ('00000000-0000-4000-8000-000000000405','status-e@bmsce.ac.in',now());
update public.profiles set first_name=case when id='00000000-0000-4000-8000-000000000401' then 'Status A' else 'Status B' end,onboarding_complete=true,is_verified=true,available_nights=array[1,2,3]::smallint[] where id in('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000402');
update public.profiles set first_name='Vibe target',onboarding_complete=true,is_verified=true where id in('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000404','00000000-0000-4000-8000-000000000405');

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000401';
do $$begin
  if (select status from public.discover_relationships() where (profile->>'id')='00000000-0000-4000-8000-000000000402') <> 'new' then raise exception 'initial status'; end if;
  if (public.set_decision('00000000-0000-4000-8000-000000000402','interested')->>'status') <> 'sent' then raise exception 'sent status'; end if;
  if (select status from public.discover_relationships() where (profile->>'id')='00000000-0000-4000-8000-000000000402') <> 'sent' then raise exception 'sent snapshot'; end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000402';
do $$begin
  if not exists(select 1 from public.get_relationship_notifications() where type='interest') then raise exception 'interest notification missing'; end if;
  perform public.set_decision('00000000-0000-4000-8000-000000000401','pass');
  if exists(select 1 from public.get_relationship_notifications() where type='interest') then raise exception 'pass notified or stale interest'; end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000402';
do $$declare result jsonb;begin
  result:=public.set_decision('00000000-0000-4000-8000-000000000401','interested');
  if result->>'status' <> 'matched' then raise exception 'pass to interest did not match'; end if;
  if (select count(*) from matches where status='active')<>1 then raise exception 'match missing'; end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000402';
do $$begin
  if (select status from public.discover_relationships() where (profile->>'id')='00000000-0000-4000-8000-000000000401') <> 'matched' then raise exception 'match precedence'; end if;
end$$;
-- Exercise the real Vibe branch, including its quota SELECT (not an HTTP mock).
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000401';
do $$begin
  perform public.set_decision('00000000-0000-4000-8000-000000000403','pass');
  if (public.set_decision('00000000-0000-4000-8000-000000000403','vibe')->>'status') <> 'sent' then raise exception 'passed to Vibe failed'; end if;
  if not exists(select 1 from likes where from_user=auth.uid() and to_user='00000000-0000-4000-8000-000000000403' and kind='garba_vibe') then raise exception 'Vibe kind missing'; end if;
  perform public.set_decision('00000000-0000-4000-8000-000000000404','vibe');
  perform public.set_decision('00000000-0000-4000-8000-000000000405','vibe');
  begin
    perform public.set_decision('00000000-0000-4000-8000-000000000402','vibe');
    raise exception 'fourth Vibe unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'daily Garba Vibe quota reached' then raise; end if;
  end;
end$$;
rollback;
\echo 'Authoritative statuses, withdraw/pass, retained incoming like, notifications, match, Vibe and quota checks passed'
