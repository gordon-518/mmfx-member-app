# MMFX Support Agent: Design

**Date:** 15 Sept 2026 · **Owner:** Gordon · **Status:** approved in brainstorming, awaiting spec review

## Goal

Answer members on the SendPulse Telegram inbox automatically: @marketmakers18bot, plus chats that reach Admin Amelia's account (@MM_3000) through Telegram Business. The agent answers everything the fact sheet covers and hands the rest to Amelia.

The 15 Sept study of 102,634 messages found 6,362 manual inbox replies, 62% of them repeat templates, and a median wait of 2.2 hours (the slowest quarter wait 13+ hours). Of 4,111 member questions, about 55% can be answered from a fact sheet, 22% is onboarding the app already handles, and 23% needs a person.

**Success looks like:**
- Most routine questions get an answer in under a minute.
- No wrong price, IB number, bonus code or link is ever sent.
- Every money or dispute question reaches Amelia with its context attached.

## Non-goals

- Editing Amelia's saved replies or the bot's flows inside SendPulse. That's dashboard work, but one flow fix is a go-live prerequisite (see Rollout).
- Verifying deposits or changing anyone's access. The agent reads status; it never writes it.
- Starting conversations. It only ever replies.

## Decisions (15 Sept)

| Decision | Choice |
|---|---|
| Reply mode | **Automatic.** No approval step. |
| Launch | **Live on deploy.** Safety comes from handoff rules, code guardrails, caps and an on/off switch. |
| Amelia's-account chats (@MM_3000, Telegram Business) | **Included.** Every reply there starts with `MMFX Assistant:`. |
| Architecture | **Agent inside the member app**, not SendPulse's built-in AI and not a hybrid. |

## Fact sheet

These are the only facts the agent may state.

**Read from the app's code, never copied**, so the agent can't drift from the product:

- **Tiers:** `src/lib/tiers.ts`. Free after the trial, **Foundation $50**, **Desk $200**, **Team MM $500**, all counted on cumulative verified deposits, never on balance. Every top-up counts toward the next tier.
- **What each tier opens:** `src/lib/access/features.ts` (plus `src/lib/access/course.ts` for the course).
  - Free: Economic Calendar, News, Know Your Style, Daily Analysis, the signals channel, course Module 1.
  - Foundation: adds the MM Library and the full course.
  - Desk: adds the TradingView indicators, strategy scripts, Live Classes and the Fundamental Desk.
  - Team MM: adds the AI Trading Assistant and the private Team MM channel.
- **Trial:** 14 days for new signups. A trial user who deposits keeps full access until the trial ends, then drops to the tier their deposits reached (`20260915000004_trial_fairness.sql`, `accessTierFor()` in `src/lib/tiers.ts`).
- **US/UK lifetime plans** (`src/lib/lifetimePlans.ts`): **Team MM Access USD 588**, **Team MM + Mentorship USD 1,588**. Payment is arranged in chat.
- **Broker routing:** `regionFor()` in `src/app/upgrade/page.tsx`. Octa/Elev8 for most countries, Dupoin for the listed countries, US/UK go to the lifetime plans. `/upgrade` detects the country itself, so the agent just sends people there.
- **Broker links and switching** (`src/app/upgrade/UpgradeFlow.tsx`): Octa/Elev8 IB **47807426**, the signup and change-partner links, and the switch reason text. Existing Dupoin clients send Admin Amelia their full name and UID.
- **Depositing** (`src/app/upgrade/*`, `src/lib/depositRef.ts`):
  1. Fund your own account (from $50).
  2. Message **Admin Amelia (@MM_3000)** with your reference code (`MM-` plus 6 characters, shown on `/upgrade`).
  3. Submit the form on `/upgrade`: broker, account number, amount, screenshot, TradingView and Telegram usernames.
  4. The team checks it in `/admin` and emails you when it's approved.
- **App links:** `/signup`, `/upgrade`, `/indicators`, `/team-mm`, `/course`. Anyone who wants to join goes to **`/upgrade`**.

**Editable in `/admin/support`** (changes without a deploy):

- **Bonus:** Dupoin's 100% deposit bonus is shown in the app. Octa/Elev8 get the code **`TeamMM001`**, seeded to expire **15 Dec 2026**. The admin edits the code and date.
- **Official accounts:** **@MM_3000** (Admin Amelia), **@MMFX_BOSS** (Gordon's personal line), **@marketmakers18bot** (the bot).
- **Office hours** for human replies. Default: "during Singapore office hours".
- **Trade cadence line.** Seeded "around 2–3 trades a day"; the admin confirms or edits it.
- **Notes:** free text the agent may use.

**Retired:** the Google Forms. `/admin` is the source of truth for deposit review.

## Architecture

```
Member → @marketmakers18bot, or @MM_3000 via Telegram Business
  → SendPulse (existing flows and the questionnaire still run)
  → webhook incoming_message → POST /api/support/webhook?key=<SUPPORT_WEBHOOK_SECRET>
  → store the message, return 200 immediately, then in after():
      1 Check   switch on? chat state = auto? not a duplicate? under the caps?
      2 Wait    20 s, then re-read the thread and continue only if:
                  · this is still the chat's latest member message, and
                  · no SendPulse flow message was sent after it (flow answers and
                    questionnaire replies win)
      3 Gather  last 15 messages · contact tags (country_*, capital_*, intent_*, exp_*)
                · business-chat flag · member match (below)
      4 Draft   Claude with the fact sheet → decision JSON
      5 Guard   code checks; one redraft with the failure reasons, then handoff
      6 Act     reply (tagged in business chats) or handoff
      7 Log     support_events
```

The webhook route sets `maxDuration = 60`, enough for the 20 s wait plus a Claude call. `after()` runs within that limit on Vercel (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`).

Step 2 is not optional. SendPulse flows answer **43%** of ordinary member messages within a minute (last 14 days), mostly the onboarding questionnaire ("how much are you planning to start with?", "where are you based?"). Many member messages are answers to those questions, and the agent must never talk over the flow.

## Member matching and what the agent may disclose

The agent matches a chat to a member in two ways, and tries them in order:

1. **Reference code.** A message containing `MM-` followed by 6 hex characters is looked up against the first 6 hex characters of `profiles.id` (dashes stripped). Only an exact single match counts.
2. **Telegram handle.** The contact's @username (case-insensitive) must equal `deposit_submissions.telegram_username` for exactly one member.

- **If matched,** the agent may state that member's tier, trial end date and latest submission status (pending, approved, or needs a fix, with the rejection reason).
- **If not matched,** it states no member-specific status and points the member to `/upgrade`, where they're logged in.
- **A reference-code DM** (the `adminDmMessage()` text, or any message containing a code) gets an automatic acknowledgement, for example: "Thanks, your reference MM-3F9A2C is noted. Submit your deposit on the upgrade page if you haven't yet. The team checks it and you'll get an email when it's approved." It never says the deposit is received or approved unless `deposit_submissions` shows `verified`.

## Components

### Tables (one new migration)

RLS for all three: admins may `SELECT`; writes are service-role only.

**`support_settings`**: a single row, `id = 1`.

| Column | Notes |
|---|---|
| `enabled` | bool, default `false` |
| `bonus_code` | text, seeded `TeamMM001` |
| `bonus_code_expires` | date, seeded `2026-12-15` |
| `official_accounts` | jsonb, seeded with the three accounts above |
| `office_hours` | text |
| `trade_cadence` | text |
| `notes` | text |
| `updated_by` | uuid |
| `updated_at` | timestamptz |

**`support_chats`**: one row per SendPulse contact.

| Column | Notes |
|---|---|
| `contact_id` | text, primary key |
| `is_business` | bool |
| `telegram_username` | text |
| `matched_user_id` | uuid, nullable |
| `state` | `auto` \| `quiet` \| `needs_amelia` |
| `quiet_until` | timestamptz |
| `handoff_reason` | text |
| `last_member_msg_at` | timestamptz |
| `last_agent_reply_at` | timestamptz |
| `updated_at` | timestamptz |

**`support_events`**: the log. Purged after 90 days by pg_cron.

| Column | Notes |
|---|---|
| `id` | |
| `contact_id` | |
| `kind` | `incoming` \| `reply` \| `handoff` \| `skip` \| `error` \| `amelia_reply` |
| `dedupe_key` | text, unique |
| `member_text` | |
| `topic` | |
| `confidence` | |
| `reply_text` | |
| `skip_reason` | |
| `guard_failures` | jsonb |
| `model` | |
| `latency_ms` | |
| `created_at` | |

### Code units

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/app/api/support/webhook/route.ts` | Check the secret; record the event; dedupe; return 200; run `run` in `after()`. Also handles `outgoing_message`, for the quiet period. | `run`, db |
| `src/lib/support/sendpulse.ts` | Token cache; `getMessages` (paged with `skip=`, since `page=` is ignored), `getContact`, `send`, `setTag`/`deleteTag`, `setPauseAutomation`/`deletePauseAutomation`, `openChat` | SendPulse API |
| `src/lib/support/facts.ts` | Build the fact sheet from code constants plus `support_settings`, and the guard's allowlist | tiers, features, lifetimePlans, UpgradeFlow constants, depositRef |
| `src/lib/support/member.ts` | Reference code or Telegram handle → member → `{tier, trialEndsAt, latestSubmission}`, on an exact single match only | db |
| `src/lib/support/agent.ts` | Prompt and Claude call; returns `{action: reply \| handoff, topic, confidence, reply, reason}` | Claude API |
| `src/lib/support/guard.ts` | Pure checks on a draft (below) | facts |
| `src/lib/support/run.ts` | Orchestrate one burst: check → wait → gather → draft → guard → act → log | all of the above |
| `src/app/admin/support/page.tsx` | Switch, fact-sheet editor, Needs-Amelia queue, activity log, today's numbers | db, server actions |
| `src/components/AppShell.tsx` | Add "Support Agent" to `ADMIN_NAV` | — |
| `src/app/api/cron/daily-stats/route.ts` | Add a Support block to the 9am Telegram DM: replies, handoffs, open Needs-Amelia chats, median response time | `support_events` |

The model is `claude-sonnet-5`, called with plain `fetch` like `src/lib/channel/draft.ts`. `SUPPORT_AGENT_MODEL` overrides it. The reply is a structured JSON decision; the implementation plan picks how, following the claude-api reference.

## Guardrails (enforced in `guard.ts`)

A draft fails any of these checks:

1. **Money amounts.** Every currency amount must be on the allowlist (tier thresholds and plan prices from code), **or** appear in the member's own last 15 messages.
2. **IB numbers.** Any 6–9 digit IB-style number must be `47807426`.
3. **Bonus codes.** Any bonus code must be the current one, and none after its expiry date.
4. **Links.** Every URL must be on the allowlist: the `app.marketmakersfx.net` paths above and the broker signup and change-partner links from `UpgradeFlow.tsx`.
5. **@handles.** Only the official accounts.
6. **Profit language.** Nothing like "guaranteed", "profit", "returns", "printing", "make money", "risk-free" or "double".
7. **Deposit claims.** It may not say a deposit is received, approved or verified unless `member.ts` returned a matching `verified` submission.
8. **Length.** No more than 900 characters.

If a check fails, the agent redrafts once, passing the failure reasons. If the redraft also fails, it hands off.

**Always handed off, whatever the draft says:**
- withdrawals
- missing or pending funds at a broker
- disputes and complaints
- refunds, or payments already made (including lifetime-plan payments)
- account deletion
- legal threats and abuse
- any decision the model marks below 0.7 confidence

## Handoff

1. Send the fixed holding line: "Thanks, I've passed this to Admin Amelia. She'll reply here during {office hours}." In business chats it gets the `MMFX Assistant:` prefix.
2. Tag the contact `needs-amelia`, pause SendPulse automation for 24 hours, and open the chat.
3. Set `support_chats.state = 'needs_amelia'` and record the reason. It stays that way until an admin clears it in `/admin/support`.
4. Ping Amelia on Telegram (`SUPPORT_PING_CHAT_ID`, via the bot in `src/lib/telegram.ts`) with the member's first name, their message and the reason. This only works once she has pressed Start on that bot. Until then, the SendPulse tag and inbox carry it.

## Staying out of the way

- **Flow answers win.** See Architecture, step 2. A fast pre-filter also skips exact matches to active SendPulse trigger keywords, fetched from `/telegram/triggers` and cached for 10 minutes.
- **Amelia replies herself.** An `outgoing_message` the agent didn't send sets `state = 'quiet'` for 60 minutes.
- **Caps.** At most 6 agent replies per chat per rolling hour, and 1,500 Claude calls per Singapore day, redrafts included. Past either cap, the agent hands off.
- **No loops.** Only `incoming_message` triggers work. The agent records its own sends, so their `outgoing_message` echoes are ignored.

## Failure handling

| Failure | Behaviour |
|---|---|
| Claude error, timeout or invalid JSON | Nothing is sent to the member. Handoff steps 2–4 run, and an `error` event is logged. |
| SendPulse send fails | Retry once after 2 s, then log and run handoff steps 2–4. |
| Duplicate webhook | Dropped. `dedupe_key` is contact id + message timestamp + text hash (swapped for a message id if the payload has one). |
| Wrong webhook secret | 401, nothing stored. |
| Switch off (`support_settings.enabled = false`, or env `SUPPORT_AGENT_ENABLED=false`) | `incoming` is logged, no replies are sent. |

## Security and privacy

- **Webhook auth.** SendPulse webhooks are unsigned, so the URL carries a long random `key`, compared in constant time.
- **Access.** Only the service role writes. Admins read the log in `/admin/support`. Events are purged after 90 days.
- **What Claude sees.** The thread, the fact sheet and, for a matched member, their tier, trial end date and latest submission status. Never email addresses, phone numbers or trading account numbers.
- **Telegram pings.** First name, the message text and the handoff reason only.

## Testing

- **Unit (vitest):**
  - every guard rule, both pass and fail cases
  - the facts builder, whose values must match `tiers.ts`, `features.ts` and `lifetimePlans.ts`
  - member matching: reference code and handle, exact single match only
  - the reference-code acknowledgement never claims approval
  - debounce, the flow-reply skip, and the caps
  - decision parsing and the redraft path
  - the handoff steps
- **Route tests:** the secret check, dedupe, switch off, the quiet period, and `outgoing_message` handling.
- **Replay before deploy:** a script runs the pipeline in dry mode (nothing sent) over about 200 real historical member questions from the 15 Sept export. It writes a report with the decision, topic, guard results and reply for each question. The report is reviewed before the PR merges.
- **Live smoke test on day 1,** from Gordon's own Telegram, in both a bot chat and an @MM_3000 chat. Confirm:
  - the webhook fires for business chats
  - the `MMFX Assistant:` prefix appears
  - a questionnaire answer is left to the flow
  - a reference code gets acknowledged
  - handoff works
  - the quiet period starts after a manual reply

## Rollout

0. **Prerequisite (Gordon, in SendPulse).** Update the join flows before switching the agent on. "Steps to Join Team MM" says minimum **USD100** and "Register with Dupoin" (1,680 sends), and "Steps to Join MM Mentorship" says **USD500**. Both contradict the live tiers, so the bot and the agent would give members different answers. Point both to `/upgrade` ($50 / $200 / $500).
1. Build on branch `support-agent`, open a PR, merge and deploy. The switch is **off** by default.
2. Apply the migration to prod. Set `SUPPORT_WEBHOOK_SECRET`, `SUPPORT_PING_CHAT_ID` and, optionally, `SUPPORT_AGENT_MODEL` in Vercel.
3. **Gordon** adds the webhook in SendPulse: Bot Settings → Webhooks, events `incoming_message` and `outgoing_message`, pointing at the URL with the key.
4. Run the smoke test together. Then Gordon switches the agent on in `/admin/support`.
5. Watch the log on day 1. The first daily summary arrives at 9am.

## To verify on day 1 (SendPulse doesn't document these)

- **Does `incoming_message` fire for Telegram Business chats?** If not, @MM_3000 chats stay manual until there's a workaround (SendPulse keyword flows, or Telegram's own business-bot updates).
- **Do Amelia's replies from her phone produce `outgoing_message`?** If not, the quiet period only covers replies sent from the SendPulse inbox. Tell her.
- **What's in the webhook payload?** Especially whether there's a message id, which decides the `dedupe_key` inputs.
