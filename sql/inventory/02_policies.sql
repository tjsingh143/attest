-- Attest probe: every row-level-security policy on an in-scope relation.
--
-- $1  text[]  application schemas
-- $2  text[]  extra schema-qualified relations
--
-- USING decides which existing rows the command may SEE or touch.
-- WITH CHECK decides which rows the command may WRITE.
-- They are different halves and a policy may have one without the other; a
-- policy with USING and no WITH CHECK on an INSERT/UPDATE path is the single
-- most common way an RLS setup leaks, so they are recorded separately and are
-- never collapsed into one "expression" column.
--
-- `polpermissive` matters just as much: PERMISSIVE policies are OR-ed together,
-- so adding one can only ever widen access. RESTRICTIVE policies are AND-ed and
-- can only narrow it.
select
  n.nspname || '.' || c.relname                   as resource,
  p.polname                                       as policy_name,
  case p.polcmd
    when 'r' then 'SELECT'
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'd' then 'DELETE'
    when '*' then 'ALL'
  end                                             as command,
  case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end as permissive,
  coalesce(
    (select array_agg(r.rolname::text order by r.rolname)
     from pg_roles r where r.oid = any (p.polroles)),
    array['PUBLIC']
  )                                               as roles,
  pg_get_expr(p.polqual,      p.polrelid)         as using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid)         as with_check_expr,
  obj_description(p.oid, 'pg_policy')             as declared_intent
from pg_policy p
join pg_class c     on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = any ($1::text[])
   or (n.nspname || '.' || c.relname) = any ($2::text[])
order by 1, 2;
