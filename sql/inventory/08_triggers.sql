-- Attest probe: triggers on in-scope relations, and which of them can refuse a write.
--
-- $1  text[]  application schemas
-- $2  text[]  extra schema-qualified relations
--
-- Not every access control in this system is a policy. Arc21 also refuses
-- writes from a trigger -- `deny_client_write`, `guard_ledger_append_only`,
-- `deny_truncate` -- and those refusals are real controls that a policy-only
-- inventory would miss in both directions: it would under-count the control
-- surface, and it would report "nothing stops a client updating this row" on a
-- table where something does.
--
-- TRUNCATE is worth calling out on its own. It is not reachable through a row
-- policy at all -- RLS does not apply to TRUNCATE -- so a table whose rows are
-- protected by a policy can still be emptied by anyone holding the TRUNCATE
-- privilege. A trigger is the only way to refuse it.
--
-- Not every trigger is a control. `set_updated_at` maintains a column; it
-- refuses nothing. So every trigger on an in-scope relation is captured, and
-- `can_refuse` marks the ones whose function can raise.
--
-- `can_refuse` is a HEURISTIC and is labelled as one wherever it is reported: it
-- tests whether the function body contains a RAISE that aborts. That will call a
-- trigger a control if it raises on a condition unrelated to authorization, and
-- it will miss one that refuses by silently returning NULL from a BEFORE trigger.
-- Both directions are wrong in principle, and one of them is wrong here in
-- practice. `guard_profile_display_name_rate` refuses by calling
-- `enforce_rate_limit()`, which raises one level down, so this test does not see
-- it and the trigger is classified as housekeeping. That miss is left in rather
-- than papered over by widening the pattern: the classification is used to sort
-- a list for a reader, never to decide whether a control exists. That is what
-- WP3 executes a statement to find out.
select
  n.nspname || '.' || c.relname                     as resource,
  t.tgname                                          as trigger_name,
  fn.nspname || '.' || f.proname                    as trigger_function,
  f.prosecdef                                       as function_security_definer,
  (f.prosrc ~* '(^|[^[:alnum:]_])raise[[:space:]]+(exception|sqlstate)') as can_refuse,
  case t.tgtype::int & 1 when 1 then 'ROW' else 'STATEMENT' end as level,
  case when (t.tgtype::int & 2)  <> 0 then 'BEFORE'
       when (t.tgtype::int & 64) <> 0 then 'INSTEAD OF'
       else 'AFTER' end                             as timing,
  array_remove(array[
    case when (t.tgtype::int & 4)  <> 0 then 'INSERT'   end,
    case when (t.tgtype::int & 8)  <> 0 then 'DELETE'   end,
    case when (t.tgtype::int & 16) <> 0 then 'UPDATE'   end,
    case when (t.tgtype::int & 32) <> 0 then 'TRUNCATE' end
  ], null)                                          as events,
  t.tgenabled                                       as enabled,
  pg_get_triggerdef(t.oid)                          as definition,
  obj_description(t.oid, 'pg_trigger')              as declared_intent
from pg_trigger t
join pg_class c      on c.oid = t.tgrelid
join pg_namespace n  on n.oid = c.relnamespace
join pg_proc f       on f.oid = t.tgfoid
join pg_namespace fn on fn.oid = f.pronamespace
where not t.tgisinternal
  and (n.nspname = any ($1::text[])
       or (n.nspname || '.' || c.relname) = any ($2::text[]))
order by 1, 2;
