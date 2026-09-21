-- Attest probe: the roles that exist, and which of them ignore row security.
--
-- No parameters. Every non-system role is listed, because "which roles exist"
-- is a WP0 question and answering it with a filtered list would beg it.
--
-- rolsuper and rolbypassrls are the two attributes that make row-level
-- security not apply. A harness connecting as a role with either one set will
-- pass every isolation test without a single policy being consulted. This
-- probe is what lets the evidence say which roles those are on this instance,
-- rather than assuming the usual answer.
select
  r.rolname                                    as role_name,
  r.rolsuper                                   as is_superuser,
  r.rolbypassrls                               as bypasses_rls,
  r.rolcanlogin                                as can_login,
  r.rolinherit                                 as inherits,
  r.rolreplication                             as can_replicate,
  coalesce(
    (select array_agg(m.rolname::text order by m.rolname)
     from pg_auth_members am join pg_roles m on m.oid = am.roleid
     where am.member = r.oid),
    '{}'::text[]
  )                                            as member_of,
  coalesce(
    (select array_agg(m.rolname::text order by m.rolname)
     from pg_auth_members am join pg_roles m on m.oid = am.member
     where am.roleid = r.oid),
    '{}'::text[]
  )                                            as members,
  shobj_description(r.oid, 'pg_authid')        as declared_intent
from pg_roles r
where r.rolname not like 'pg\_%'
order by 1;
