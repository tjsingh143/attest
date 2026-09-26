# Arc21's data protections — a one-page summary

*For readers without a technical background. Drafted by AI from the assessment's recorded results and not written by the author (Amendment A2); every number comes from the recorded tests. Results as of 2026-09-25.*

**What was checked.** Arc21 is a multiplayer card game its author built. Every player has things that should stay theirs: a balance of game chips, friends and blocked players, privacy settings, games in progress. The game's database carries rules that decide who may see or change each of these. The question here was simple: do those rules actually hold when someone tries to get around them?

**How.** A test program pretended to be different players — and sometimes nobody at all, or a player whose account had just been deleted — and made 345 attempts, from reading another player's chip balance to rewriting the record of chip movements. Each attempt was written down: what was tried, as whom, what should have happened, what did happen, and when. Before any of that counted, the program proved it could tell a working rule from one broken on purpose, in 5 of 5 deliberate tests.

**What was found.**

- **283 of the 345 attempts behaved exactly as intended.** Every direct attempt to read or change another player's own records, to get at data without signing in, or to change chips outside the game's own rules was stopped. The chip balance stayed correct even when two changes arrived at the same moment.
- **5 attempts showed a rule not holding.** One is still open: a signed-in player who knows the long code that identifies another player's phone can use one of the game's own features to take over that phone's alert registration, so its owner may stop getting their alerts. How an attacker could learn that code was not tested. The other 4 show players with a private profile still named on leaderboards; the author decided that is intended, because the game is designed to keep players visible on leaderboards even when their profile is private.
- **19 checks found no complete record of who changed what** — none at all for 17 kinds of important information, and only part of one for 2 more, which the author accepted as enough. Under a rule the author set, 13 of the 17 — among them privacy settings, friendships and blocks, game and tournament results, and the game's rules and abuse limits — should keep such a history, and none exists yet. Without it, nobody could work out afterwards who changed an important setting or result.
- **25 results are facts rather than passes or fails**, and **13 could not be measured** — for example, deleting an account removes everything it owned, so there was nothing left to test. Those 13 are not counted as passes.

**What it means.** The direct protections that keep each player's own data to themselves held every time they were tested. The weaknesses are narrower: one built-in feature that lets a player take over another player's phone alerts, and the missing history of changes, which would make it hard to investigate a problem after the fact.

**What this is not.** Nothing was fixed: the findings are recommendations for the game's author. The author tested their own game with a tool they wrote, so this is not an independent audit, and the game is not a regulated system. It covers the stored data and who can reach it — not passwords, the network, or the app's screens.

*For readers of the technical report: these are the 283 effective, 5 deficient, 19 gap, 25 characterized and 13 not measured results of run 20260925T014011Z-5695a4c3df2d.*
