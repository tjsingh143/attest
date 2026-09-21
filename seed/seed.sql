-- =============================================================================
-- Attest — deterministic seed for the disposable instance
--
-- SYNTHETIC DATA. Every row below is fabricated by this file for the purpose of
-- testing access controls. None of it is real user data, and none of it is
-- evidence of anything. Evidence is only ever the recorded outcome of a real
-- statement execution; see evidence/runs/.
--
-- Determinism is the point. Every identifier here is a literal, so two runs of
-- the harness against the same migrations produce byte-identical starting
-- state, and a test that fails can be re-run against exactly the rows it failed
-- against. Catalogue rows (ruleset, career nodes, cosmetics) are NOT created
-- here -- they ship in Arc21's own migrations -- and are selected by their
-- stable `code` so this file does not hard-code an id it does not own.
--
-- Runs as the admin role, after `supabase db reset`, against an empty instance.
-- It asserts emptiness rather than upserting, because a seed that silently
-- tolerates leftover state would let a previous run's rows contaminate this
-- run's evidence.
--
-- The shape below is chosen to give the control tests something real to attack:
--
--   alice, bob, carol  three ordinary accounts, each owning a full set of rows
--   dave               a fourth account, reserved for the deleted-identity
--                      boundary case; it is seeded live and deleted by the test
--   one game session   hosted by alice, with alice and bob seated and CAROL NOT
--                      SEATED -- so "participant" policies have a genuine
--                      negative subject rather than only a positive one
--   one friendship     alice <-> bob
--   one block          alice blocks dave
-- =============================================================================

do $$
begin
  if (select count(*) from auth.users) <> 0 then
    raise exception
      'Attest seed expects an empty instance; found % rows in auth.users. Run bringup, which resets from migrations first.',
      (select count(*) from auth.users);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Accounts
--
-- Inserting into auth.users is sufficient: Arc21's `on_auth_user_created`
-- trigger calls handle_new_user(), which is SECURITY DEFINER and creates the
-- profile, the wallet, the 25,000-chip initial ledger grant and the stats row.
-- Seeding through the application's own bootstrap rather than around it means
-- the seeded state is state the application can actually produce.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@attest.test', 'authenticated', 'authenticated',
   '{"username": "alice_a", "display_name": "Alice"}'::jsonb),
  ('00000000-0000-4000-8000-00000000000b', 'bob@attest.test',   'authenticated', 'authenticated',
   '{"username": "bob_b",   "display_name": "Bob"}'::jsonb),
  ('00000000-0000-4000-8000-00000000000c', 'carol@attest.test', 'authenticated', 'authenticated',
   '{"username": "carol_c", "display_name": "Carol"}'::jsonb),
  ('00000000-0000-4000-8000-00000000000d', 'dave@attest.test',  'authenticated', 'authenticated',
   '{"username": "dave_d",  "display_name": "Dave"}'::jsonb);

-- -----------------------------------------------------------------------------
-- Per-account owned rows
-- -----------------------------------------------------------------------------
insert into public.loadouts (id, user_id) values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a'),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000b'),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000c');

insert into public.push_tokens (id, user_id, token, platform, device_id) values
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
   'ExponentPushToken[attest-alice]', 'ios',     'attest-device-alice'),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000b',
   'ExponentPushToken[attest-bob]',   'android', 'attest-device-bob'),
  ('b0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000c',
   'ExponentPushToken[attest-carol]', 'ios',     'attest-device-carol');

insert into public.notifications (id, user_id, kind, title, body) values
  ('c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
   'system', 'Seeded notification', 'Synthetic row owned by alice.'),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000b',
   'system', 'Seeded notification', 'Synthetic row owned by bob.'),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000c',
   'system', 'Seeded notification', 'Synthetic row owned by carol.');

insert into public.career_progress (id, user_id, career_node_id, status, stars, attempts)
select
  ids.id, ids.user_id,
  (select id from public.career_nodes order by code limit 1),
  'available', 0, 0
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-00000000000a'::uuid),
  ('d0000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-00000000000b'::uuid),
  ('d0000000-0000-4000-8000-000000000003'::uuid, '00000000-0000-4000-8000-00000000000c'::uuid)
) as ids(id, user_id);

-- -----------------------------------------------------------------------------
-- Shared state: one live table, two of the three accounts seated
--
-- Carol's absence is deliberate. A policy that admits "a participant" is only
-- shown to work if a non-participant is present to be refused, and Realtime
-- topic authorization keys on exactly this seat.
-- -----------------------------------------------------------------------------
insert into public.game_sessions (id, mode, ruleset_id, tier, host_user_id, status, max_seats)
values (
  'e0000000-0000-4000-8000-000000000001',
  'private_table',
  (select id from public.rulesets order by id limit 1),
  'casual',
  '00000000-0000-4000-8000-00000000000a',
  'active',
  5
);

insert into public.game_session_seats
  (id, game_session_id, seat_index, user_id, display_name, stack, buy_in, status)
values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   0, '00000000-0000-4000-8000-00000000000a', 'Alice', 1000, 1000, 'active'),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001',
   1, '00000000-0000-4000-8000-00000000000b', 'Bob',   1000, 1000, 'active');

-- -----------------------------------------------------------------------------
-- Social graph
-- -----------------------------------------------------------------------------
insert into public.friendships (id, user_id_a, user_id_b) values
  ('aa000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b');

insert into public.blocks (id, blocker_id, blocked_id) values
  ('bb000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000d');
