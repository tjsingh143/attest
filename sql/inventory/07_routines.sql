-- Attest probe: functions in the application schemas, and their privilege posture.
--
-- $1  text[]  application schemas
-- $2  text[]  roles reachable from outside the server
--
-- A SECURITY DEFINER function runs with the privileges of the role that owns
-- it, not the caller's. That is not a defect -- it is how a server-authoritative
-- write is meant to happen -- but it means the function, not the policy, is the
-- access control. Every one of them is a place where the caller's policies stop
-- applying, so every one of them belongs in the inventory.
--
-- Two further columns matter and are easy to miss:
--
--   config       A SECURITY DEFINER function without a pinned `search_path` can
--                be made to resolve an unqualified name to an object the caller
--                controls. `proconfig` is where `SET search_path` is recorded.
--
--   executable_by  A SECURITY DEFINER function nobody can execute is not a
--                risk. One granted to `anon` is a different proposition
--                entirely. The grant, not the flag, decides the exposure.
select
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
                                                    as resource,
  n.nspname                                         as schema_name,
  p.proname                                         as routine_name,
  pg_get_function_identity_arguments(p.oid)         as arguments,
  pg_get_userbyid(p.proowner)                       as owner,
  p.prosecdef                                       as security_definer,
  p.provolatile                                     as volatility,
  l.lanname                                         as language,
  p.proconfig                                       as config,
  coalesce(
    (select array_agg(distinct coalesce(g.rolname,'PUBLIC')::text order by coalesce(g.rolname,'PUBLIC')::text)
     from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     left join pg_roles g on g.oid = a.grantee
     where a.privilege_type = 'EXECUTE'
       and coalesce(g.rolname,'PUBLIC') = any ($2::text[])),
    '{}'::text[]
  )                                                 as executable_by,
  pg_get_functiondef(p.oid)                         as definition,
  obj_description(p.oid, 'pg_proc')                 as declared_intent
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l  on l.oid = p.prolang
where n.nspname = any ($1::text[])
  and p.prokind = 'f'
order by 1;
