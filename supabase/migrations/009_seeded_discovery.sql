begin;
create or replace function public.discovery_overlap(a text[],b text[]) returns double precision
language sql immutable set search_path=public as $$
  select case when count(*)=0 then 0 else count(*) filter(where in_a and in_b)::double precision/count(*) end
  from (select v,bool_or(side=1) in_a,bool_or(side=2) in_b from
    (select unnest(a) v,1 side union all select unnest(b) v,2 side) s group by v) t;
$$;

-- Keyset pagination: exclusions changing between pages cannot shift offsets.
-- Every request carries the in-memory seed; per-ID keys do not depend on order.
create or replace function public.discover_feed(p_seed text,p_after_key double precision default null,p_after_id uuid default null,p_limit integer default 64)
returns table(profile jsonb,rank_key double precision,score integer)
language plpgsql stable security definer set search_path=public as $$
declare me public.profiles;
begin
  if auth.uid() is null or length(p_seed)<1 or length(p_seed)>200 then raise exception 'invalid feed session'; end if;
  select * into me from public.profiles where id=auth.uid();
  if me.id is null or not me.onboarding_complete then return; end if;
  return query with candidates as (
    select p.*,round(100*(
      .30*discovery_overlap(me.available_nights::text[],p.available_nights::text[])
      +.20*case when 'Any'=any(me.styles) or 'Any'=any(p.styles) then 1 else discovery_overlap(me.styles,p.styles) end
      +.15*case when me.year=p.year then 1 when abs(me.year-p.year)=1 then .6 else .2 end
      +.15*case when me.branch=p.branch then 1 else .4 end
      +.10*discovery_overlap(me.interests,p.interests)
      +.10*case when 'Open to anything'=any(me.looking_for) or 'Open to anything'=any(p.looking_for) then 1 else discovery_overlap(me.looking_for,p.looking_for) end
    ))::integer compatibility
    from public.profiles p where p.id<>me.id and p.onboarding_complete and not p.is_hidden and not p.is_suspended and not p.is_banned
      and (me.partner_preference='Everyone' or (me.partner_preference='Women' and p.gender='Woman') or (me.partner_preference='Men' and p.gender='Man') or (me.partner_preference='Non-binary' and p.gender='Non-binary'))
      and (p.partner_preference='Everyone' or (p.partner_preference='Women' and me.gender='Woman') or (p.partner_preference='Men' and me.gender='Man') or (p.partner_preference='Non-binary' and me.gender='Non-binary'))
      and not exists(select 1 from public.blocks b where (b.blocker_id=me.id and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=me.id))
      and not exists(select 1 from public.likes l where l.from_user=me.id and l.to_user=p.id)
      and not exists(select 1 from public.passes ps where ps.from_user=me.id and ps.to_user=p.id)
      and not exists(select 1 from public.matches m where m.status='active' and m.user_a=least(me.id,p.id) and m.user_b=greatest(me.id,p.id))
  ), ranked as (
    select to_jsonb(c)-'compatibility' p,c.id,
      -ln(((('x'||substr(md5(p_seed||':'||me.id::text||':'||c.id::text),1,13))::bit(52)::bigint)::double precision+.5)/4503599627370496.0)/(.35+c.compatibility/100.0) k,c.compatibility s
    from candidates c
  ) select r.p,r.k,r.s from ranked r
    where p_after_key is null or (r.k,r.id)>(p_after_key,p_after_id)
    order by r.k,r.id limit greatest(1,least(100,p_limit));
end; $$;
revoke all on function public.discover_feed(text,double precision,uuid,integer) from public,anon;
grant execute on function public.discover_feed(text,double precision,uuid,integer) to authenticated;
commit;
