-- Attest probe: USAGE and CREATE on schemas, per client-reachable role.
--
-- $1  text[]  roles reachable from outside the server
--
-- Schema USAGE is the outer gate. Without it, a grant on a table inside that
-- schema is unreachable -- which is exactly how Arc21's `private` schema is
-- meant to work, and is a control in its own right rather than an absence of
-- one. Recording it separately is what lets the gap list tell "locked at the
-- schema door" apart from "left open".
select
  n.nspname                         as resource,
  coalesce(g.rolname, 'PUBLIC')     as grantee,
  a.privilege_type                  as privilege
from pg_namespace n
cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
left join pg_roles g on g.oid = a.grantee
where n.nspname not in ('pg_catalog','information_schema','pg_toast')
  and n.nspname not like 'pg\_%'
  and coalesce(g.rolname, 'PUBLIC') = any ($1::text[])
order by 1, 2, 3;
