-- Narrow repair for already-applied 012. The PL/pgSQL variable "kind" shadowed
-- likes.kind in the quota SELECT, causing every real Vibe call to fail.
-- Preserve the deployed function body/grants; qualify only that legacy clause.
begin;
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.set_decision(uuid,text)'::regprocedure);
  definition := replace(definition,
    'from likes where from_user=actor and kind=''garba_vibe'' and created_at>=',
    'from public.likes l where l.from_user=actor and l.kind=''garba_vibe'' and l.created_at>=');
  execute definition;
end;
$$;
notify pgrst, 'reload schema';
commit;
