-- Attest probe: relations in scope, and their row-level-security state.
--
-- $1  text[]  application schemas
-- $2  text[]  extra schema-qualified relations outside those schemas
--
-- `relrowsecurity` and `relforcerowsecurity` are read separately and on
-- purpose. Enabled means the policies are consulted for ordinary roles.
-- FORCED means they are also consulted for the table's OWNER. A table that is
-- enabled but not forced is wide open to whoever owns it, and on a Supabase
-- instance that owner is the same role most tooling connects as.
--
-- The table comment is captured as DECLARED INTENT, never as evidence. It is
-- what the author says the control does; every other column here is what the
-- database says it is.
select
  n.nspname                                       as schema_name,
  c.relname                                       as rel_name,
  n.nspname || '.' || c.relname                   as resource,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
  end                                             as rel_kind,
  pg_get_userbyid(c.relowner)                     as owner,
  c.relrowsecurity                                as rls_enabled,
  c.relforcerowsecurity                           as rls_forced,
  (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policy_count,
  -- A view's security_invoker setting decides whether the underlying tables'
  -- policies apply to the caller or to the view's owner. A security_definer
  -- view over an RLS-protected table is a bypass.
  case when c.relkind = 'v'
       then coalesce((select option_value = 'true'
                      from pg_options_to_table(c.reloptions)
                      where option_name = 'security_invoker'), false)
  end                                             as view_security_invoker,
  obj_description(c.oid, 'pg_class')              as declared_intent
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p','v','m')
  and (n.nspname = any ($1::text[])
       or (n.nspname || '.' || c.relname) = any ($2::text[]))
order by 1, 2;
