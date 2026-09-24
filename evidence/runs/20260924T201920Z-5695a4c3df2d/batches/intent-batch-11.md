# AUTHOR INTENT — batch 11 of 13

**F5 (51–57 of 57)** · 7 rows · run `20260924T201920Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 0 of the 7 proposed sentences in this file were written by the
> harness, not by the author, and 7 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F5.my_sprint_entry.296`

| | |
|---|---|
| Control | `public.my_sprint_entry#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_sprint_entry() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rides the definer privilege inside my_sprint_entry() past their own rows to read a different account's live tournament position.

**AUTHOR INTENT:** A signed-in player rides the definer privilege inside my_sprint_entry() past their own rows to read a different account's live tournament position.

#### 2. `F5.my_strategy_accuracy_progress.297`

| | |
|---|---|
| Control | `public.my_strategy_accuracy_progress#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_strategy_accuracy_progress() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rides the definer privilege inside my_strategy_accuracy_progress() past their own rows to read a different account's graded strategy accuracy.

**AUTHOR INTENT:** A signed-in player rides the definer privilege inside my_strategy_accuracy_progress() past their own rows to read a different account's graded strategy accuracy.

#### 3. `F5.touch_last_seen.298`

| | |
|---|---|
| Control | `public.touch_last_seen#security_definer` |
| Runs as | authenticated:alice |
| Operation | call touch_last_seen() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rides the definer privilege inside touch_last_seen() past their own rows to move a different account's last-seen timestamp, making a dormant account look active.

**AUTHOR INTENT:** A signed-in player rides the definer privilege inside touch_last_seen() past their own rows to move a different account's last-seen timestamp, making a dormant account look active.

#### 4. `F5.unread_notification_count.299`

| | |
|---|---|
| Control | `public.unread_notification_count#security_definer` |
| Runs as | authenticated:alice |
| Operation | call unread_notification_count() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rides the definer privilege inside unread_notification_count() past their own rows to learn how many unread notifications a different account is holding.

**AUTHOR INTENT:** A signed-in player rides the definer privilege inside unread_notification_count() past their own rows to learn how many unread notifications a different account is holding.

#### 5. `F5.enforce_rate_limit.300`

| | |
|---|---|
| Control | `public.enforce_rate_limit#security_definer` |
| Runs as | authenticated:alice |
| Operation | call enforce_rate_limit(p_action text) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rides the definer privilege inside enforce_rate_limit() past their own rows to consume — or reset — a different account's rate-limit budget.

**AUTHOR INTENT:** A signed-in player rides the definer privilege inside enforce_rate_limit() past their own rows to consume — or reset — a different account's rate-limit budget.

#### 6. `F5.my_leaderboard_position.301`

| | |
|---|---|
| Control | `public.my_leaderboard_position#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_leaderboard_position(p_category text) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rides the definer privilege inside my_leaderboard_position() past their own rows to read a different account's private leaderboard standing.

**AUTHOR INTENT:** A signed-in player rides the definer privilege inside my_leaderboard_position() past their own rows to read a different account's private leaderboard standing.

#### 7. `F5.my_notifications.302`

| | |
|---|---|
| Control | `public.my_notifications#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_notifications(p_limit integer) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rides the definer privilege inside my_notifications() past their own rows to read a different account's notifications.

**AUTHOR INTENT:** A signed-in player rides the definer privilege inside my_notifications() past their own rows to read a different account's notifications.
