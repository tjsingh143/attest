-- Attest probe: what is published for replication, and therefore what Realtime
-- can fan out.
--
-- No parameters.
--
-- Supabase Realtime has two separate mechanisms and they fail differently:
--
--   Postgres Changes  a table is added to the `supabase_realtime` publication
--                     and row changes are streamed. The subscriber's RLS is
--                     applied per row by the Realtime server.
--   Broadcast         clients publish and subscribe to named topics, and
--                     authorization is RLS on `realtime.messages` keyed on
--                     `realtime.topic()`.
--
-- An empty `supabase_realtime` publication therefore does not mean "no realtime
-- exposure"; it means the exposure is on the Broadcast side and must be read
-- from the policies on realtime.messages instead. Both halves are recorded so
-- the inventory cannot be read as claiming the wrong one.
select
  p.pubname                                    as publication,
  p.puballtables                               as all_tables,
  p.pubinsert, p.pubupdate, p.pubdelete, p.pubtruncate,
  coalesce(
    (select array_agg(pt.schemaname || '.' || pt.tablename order by pt.schemaname, pt.tablename)
     from pg_publication_tables pt where pt.pubname = p.pubname),
    '{}'::text[]
  )                                            as tables
from pg_publication p
order by 1;
