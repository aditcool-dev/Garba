-- Read-only pre-cleanup audit; no profile names, emails or USNs printed.
select count(*) total_profiles,
 count(*) filter(where coalesce((to_jsonb(p)->>'is_demo')::boolean,false)) flagged_demo,
 count(*) filter(where p.id::text ~ '^(demo-|bms-)') prefixed_ids,
 count(*) filter(where coalesce((to_jsonb(p)->>'is_sample')::boolean,false)) samples,
 count(*) filter(where to_jsonb(p)::text ~* '(demo-|bms-|\m[0-9]bm[0-9]{2}[a-z]{2}[0-9]{3}\M)') rows_with_legacy_markers
from public.profiles p;
select count(*) auth_users,
 count(*) filter(where coalesce(raw_app_meta_data->>'is_demo','false')='true' or coalesce(raw_app_meta_data->>'legacy_id','') ~ '^(demo-|bms-)') definite_demo_auth
from auth.users;
select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in('profiles','matches','messages') and (column_name in('has_seen_discover_tutorial','chat_started_at','is_sample','is_verified') or column_name ilike '%usn%');
select p.proname,pg_get_function_identity_arguments(p.oid) arguments from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('discover_feed','like_user','unmatch_user','discovery_blocked_ids','mark_discover_tutorial_seen','get_incoming_interests','get_user_notifications','mark_chat_read');
select c.relname table_name,c.relrowsecurity rls_enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname;
select tablename,policyname,cmd from pg_policies where schemaname='public' order by tablename,policyname;
