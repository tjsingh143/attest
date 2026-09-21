-- Attest risk input: what is actually stored in each in-scope relation.
--
-- $1  text[]  application schemas
-- $2  text[]  extra schema-qualified relations
--
-- This is NOT a control. It is here because the rubric's first dimension is
-- "what the data is", and that cannot be scored from a list of policies. A
-- table called `loadouts` and a table called `wallets` carry the same number of
-- row policies and are not the same kind of thing, and the difference is in the
-- columns.
--
-- Column comments are captured for the same reason table comments are in the
-- control inventory: they are the author's declared intent, recorded beside the
-- fact rather than in place of it.
select
  n.nspname || '.' || c.relname                        as resource,
  a.attname                                            as column_name,
  format_type(a.atttypid, a.atttypmod)                 as data_type,
  a.attnotnull                                         as not_null,
  pg_get_expr(d.adbin, d.adrelid)                      as default_expr,
  col_description(c.oid, a.attnum)                     as declared_intent,
  -- A generated or identity column cannot be written by a client at all.
  (a.attidentity <> '' or a.attgenerated <> '')        as server_generated,
  -- Needed to work out which relations ARE a person rather than merely
  -- referencing one: a table whose primary key is a foreign key to auth.users
  -- is an identity table, and anything pointing at it points at a person too.
  coalesce((select i.indisprimary
              from pg_index i
             where i.indrelid = c.oid and i.indisprimary
               and a.attnum = any (i.indkey)), false)  as is_primary_key
from pg_attribute a
join pg_class c      on c.oid = a.attrelid
join pg_namespace n  on n.oid = c.relnamespace
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attnum > 0
  and not a.attisdropped
  and c.relkind in ('r','p','v','m')
  and (n.nspname = any ($1::text[])
       or (n.nspname || '.' || c.relname) = any ($2::text[]))
order by 1, a.attnum;
