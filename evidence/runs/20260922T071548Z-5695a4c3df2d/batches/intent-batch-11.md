# AUTHOR INTENT — batch 11 of 13

**F5 (51–57 of 57)** · 7 rows · run `20260922T071548Z-5695a4c3df2d`

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

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 2. `F5.my_strategy_accuracy_progress.297`

| | |
|---|---|
| Control | `public.my_strategy_accuracy_progress#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_strategy_accuracy_progress() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 3. `F5.touch_last_seen.298`

| | |
|---|---|
| Control | `public.touch_last_seen#security_definer` |
| Runs as | authenticated:alice |
| Operation | call touch_last_seen() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 4. `F5.unread_notification_count.299`

| | |
|---|---|
| Control | `public.unread_notification_count#security_definer` |
| Runs as | authenticated:alice |
| Operation | call unread_notification_count() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 5. `F5.enforce_rate_limit.300`

| | |
|---|---|
| Control | `public.enforce_rate_limit#security_definer` |
| Runs as | authenticated:alice |
| Operation | call enforce_rate_limit(p_action text) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 6. `F5.my_leaderboard_position.301`

| | |
|---|---|
| Control | `public.my_leaderboard_position#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_leaderboard_position(p_category text) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 7. `F5.my_notifications.302`

| | |
|---|---|
| Control | `public.my_notifications#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_notifications(p_limit integer) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_
