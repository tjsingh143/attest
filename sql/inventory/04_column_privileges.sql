-- Attest probe: COLUMN-level privileges held by client-reachable roles.
--
-- $1  text[]  roles reachable from outside the server
--
-- Column grants are separate from table grants and are invisible to any check
-- that looks only at the table. `grant update (balance) on wallets to
-- authenticated` does not appear in relacl at all. A harness that inventories
-- table privileges and stops there will report a wallet as unwritable while a
-- column grant makes it writable.
select
  n.nspname || '.' || c.relname                  as resource,
  att.attname                                    as column_name,
  coalesce(g.rolname, 'PUBLIC')                  as grantee,
  a.privilege_type                               as privilege,
  a.is_grantable
from pg_attribute att
join pg_class c     on c.oid = att.attrelid
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(att.attacl) a
left join pg_roles g on g.oid = a.grantee
where att.attacl is not null
  and att.attnum > 0
  and not att.attisdropped
  and n.nspname not in ('pg_catalog','information_schema','pg_toast')
  and coalesce(g.rolname, 'PUBLIC') = any ($1::text[])
order by 1, 2, 3, 4;
