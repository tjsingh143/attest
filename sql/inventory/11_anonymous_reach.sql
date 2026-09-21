-- Attest probe: everything a signed-out caller can reach, anywhere on the instance.
--
-- $1  text[]  application schemas
--
-- WP0 asks what the anonymous role can reach. That question is not answerable
-- by looking only at the schemas the application defines. On a Supabase
-- instance `anon` arrives holding privileges on platform tables that no
-- application migration ever mentions -- storage objects, the function-hook
-- tables -- and a harness scoped to `public` would report a clean anonymous
-- surface while that was true.
--
-- So this sweeps every schema and every object kind a client can name, and
-- flags whether each result belongs to the application. The flag matters: a
-- platform default is not a defect in the author's code and must not be
-- reported as one. It is still part of the honest answer to "what can a
-- signed-out caller reach", which is why it is here rather than filtered away.
--
-- A grant is only reach if the schema is also enterable, so USAGE is checked.
--
-- `pg_catalog` and `information_schema` are excluded from both halves. Every
-- PostgreSQL installation grants PUBLIC read on the catalogs and EXECUTE on
-- several hundred built-in functions; including them adds 300 rows that are
-- true of every database in the world and tell you nothing about this one. The
-- exclusion is recorded here rather than left implicit, because "what anon can
-- reach" with a silent filter on it is a different claim from the one the
-- heading makes.
with usable as (
  select n.nspname
  from pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
  left join pg_roles g on g.oid = a.grantee
  where a.privilege_type = 'USAGE'
    and coalesce(g.rolname, 'PUBLIC') in ('anon', 'PUBLIC')
)
select
  'relation'                                   as object_type,
  n.nspname || '.' || c.relname                as resource,
  n.nspname                                    as schema_name,
  (n.nspname = any ($1::text[]))               as in_application_schema,
  coalesce(g.rolname, 'PUBLIC')                as grantee,
  string_agg(distinct a.privilege_type, ', ' order by a.privilege_type) as privileges,
  bool_or(c.relrowsecurity)                    as rls_enabled,
  max((select count(*) from pg_policy p where p.polrelid = c.oid))::int as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join usable u on u.nspname = n.nspname
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
left join pg_roles g on g.oid = a.grantee
where c.relkind in ('r','p','v','m')
  and n.nspname not in ('pg_catalog','information_schema')
  and coalesce(g.rolname, 'PUBLIC') in ('anon', 'PUBLIC')
group by 1,2,3,4,5

union all

select
  'function',
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  n.nspname,
  (n.nspname = any ($1::text[])),
  coalesce(g.rolname, 'PUBLIC'),
  case when p.prosecdef then 'EXECUTE (SECURITY DEFINER)' else 'EXECUTE' end,
  null::boolean,
  null::int
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join usable u on u.nspname = n.nspname
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
left join pg_roles g on g.oid = a.grantee
where a.privilege_type = 'EXECUTE'
  and coalesce(g.rolname, 'PUBLIC') in ('anon', 'PUBLIC')
  and n.nspname not in ('pg_catalog','information_schema')
group by 1,2,3,4,5,6

order by 4 desc, 3, 2;
