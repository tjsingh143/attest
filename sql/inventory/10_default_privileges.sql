-- Attest probe: default privileges.
--
-- $1  text[]  roles reachable from outside the server
--
-- `ALTER DEFAULT PRIVILEGES` decides what a table created TOMORROW will grant
-- the moment it exists. It is the difference between "a new table is unreachable
-- until someone grants on it" and "a new table is readable by every signed-in
-- account from the instant it is created, before anyone has written a policy".
--
-- It is invisible on every existing table, which is why it is probed on its own
-- and why it matters most to drift detection rather than to today's snapshot.
select
  coalesce(n.nspname, '(all schemas)')      as schema_name,
  pg_get_userbyid(d.defaclrole)             as owner_role,
  case d.defaclobjtype
    when 'r' then 'table'    when 'S' then 'sequence'
    when 'f' then 'function' when 'T' then 'type'
    when 'n' then 'schema'
  end                                       as object_type,
  coalesce(g.rolname, 'PUBLIC')             as grantee,
  a.privilege_type                          as privilege
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) a
left join pg_roles g on g.oid = a.grantee
where coalesce(g.rolname, 'PUBLIC') = any ($1::text[])
order by 1, 3, 4, 5;
