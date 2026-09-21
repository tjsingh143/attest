-- Attest probe: table-level privileges held by roles a client can present.
--
-- $1  text[]  roles reachable from outside the server (anon, authenticated, ...)
--
-- Deliberately NOT restricted to the application schemas. The question "what
-- can the anonymous role reach" is not answerable by looking only at the
-- schemas you remember writing; a grant on a platform table counts just the
-- same. So this sweeps every non-system schema and filters by grantee.
--
-- aclexplode is used rather than information_schema.role_table_grants because
-- information_schema resolves PUBLIC into the set of current roles and so
-- cannot tell you that a grant was made to PUBLIC. A grant to PUBLIC reaches
-- anon, and that distinction is the whole point of the probe.
select
  n.nspname || '.' || c.relname                               as resource,
  n.nspname                                                   as schema_name,
  c.relname                                                   as rel_name,
  coalesce(g.rolname, 'PUBLIC')                               as grantee,
  a.privilege_type                                            as privilege,
  a.is_grantable,
  coalesce(o.rolname, 'PUBLIC')                               as grantor
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
left join pg_roles g on g.oid = a.grantee
left join pg_roles o on o.oid = a.grantor
where c.relkind in ('r','p','v','m')
  and n.nspname not in ('pg_catalog','information_schema','pg_toast')
  and coalesce(g.rolname, 'PUBLIC') = any ($1::text[])
order by 1, 4, 5;
