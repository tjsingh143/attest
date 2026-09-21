-- Attest risk input: which relations depend on which.
--
-- $1  text[]  application schemas
-- $2  text[]  extra schema-qualified relations
--
-- Two rubric dimensions need this and neither can be answered from a policy
-- list.
--
--   blast radius      A table nothing references can only damage itself. A
--                     table many others point at is shared state, and a control
--                     failure there reaches everything downstream of it.
--   integrity impact  If a failure here corrupts rows other tables are joined
--                     to, the damage is not confined to the row that was
--                     written.
--
-- Both directions are reported. `references_count` is how many relations this
-- one points at; `referenced_by_count` is how many point at it. The second is
-- the one that matters for blast radius, and it is the one nobody remembers to
-- look up.
--
-- ON DELETE behaviour is included because it decides whether a deletion
-- propagates: a CASCADE turns one removed row into many.
select
  cn.nspname || '.' || cl.relname                      as resource,
  con.conname                                          as constraint_name,
  -- The constrained columns, so "which column says whose row this is" is a
  -- fact from the catalog rather than a guess from the column's name.
  (select array_agg(a.attname::text order by k.ord)
     from unnest(con.conkey) with ordinality as k(attnum, ord)
     join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum)
                                                       as columns,
  fn.nspname || '.' || fl.relname                      as other_relation,
  case con.confdeltype
    when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'  when 'd' then 'SET DEFAULT'
  end                                                  as on_delete
from pg_constraint con
join pg_class cl      on cl.oid = con.conrelid
join pg_namespace cn  on cn.oid = cl.relnamespace
join pg_class fl      on fl.oid = con.confrelid
join pg_namespace fn  on fn.oid = fl.relnamespace
where con.contype = 'f'
  and (cn.nspname = any ($1::text[]) or (cn.nspname || '.' || cl.relname) = any ($2::text[])
       or fn.nspname = any ($1::text[]) or (fn.nspname || '.' || fl.relname) = any ($2::text[]))
order by 1, 2;
