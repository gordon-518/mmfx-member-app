# MMFX Support Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Answer members on the SendPulse Telegram inbox (@marketmakers18bot, and @MM_3000 via Telegram Business) automatically from a code-backed fact sheet, and hand money, dispute and unclear questions to Admin Amelia.

**Architecture:** SendPulse posts `incoming_message` / `outgoing_message` webhooks to a new route. The route stores the event and returns 200. After a 20 s wait (`after()`), `run.ts` re-reads the thread from the SendPulse API, which is the source of truth. It skips if a flow already answered, gathers the member's context, asks Claude for a structured decision, checks the draft in code (`guard.ts`), then replies or hands off. Everything is logged in Supabase and controlled from `/admin/support`.

**Tech Stack:** Next.js 16 (App Router route handlers, `after()`, server actions), Supabase (Postgres + RLS, pg_cron), `@anthropic-ai/sdk` + `zod` (structured output), SendPulse Chatbots API, vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-support-agent-design.md`

---

## Changes from the spec (made while planning)

These follow the bundled Claude API reference, which is authoritative for LLM code:

1. **SDK instead of plain `fetch`.** TypeScript projects call Claude through `@anthropic-ai/sdk`. This gives schema-checked structured output (`zodOutputFormat`), typed errors and built-in retries.
2. **Default model `claude-opus-5`**, not `claude-sonnet-5`. `SUPPORT_AGENT_MODEL` still overrides it. Effort is `medium`, since this is short-form Q&A.
3. **Refusal fallbacks on:** `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`. A final `stop_reason: "refusal"` hands off.
4. **`maxDuration = 120`** on the webhook route, not 60. That covers the 20 s wait, two Claude calls (draft + one redraft) at a 35 s timeout each, and SendPulse round-trips.
5. **The webhook is a trigger only.** The thread is always re-read with `getMessages`, so payload quirks (the Telegram vs WhatsApp shape, a missing message id) can't break the agent.
6. **No keyword pre-filter.** The spec's quick skip for SendPulse trigger keywords is dropped. The flow-answered check after the 20 s wait already covers keyword triggers, with one less moving part.
7. **Flow links, not flow starts.** The agent sends approved flow links (the bot link, per Gordon). Starting flows directly through `/telegram/flows/run` is a follow-up. `runFlow` and `flow:ID` entries stay in the client and settings so it's a small change later.
8. **Redaction before Claude.** Thread text passes through `redactForModel()` (emails, phone numbers, 6+ digit account numbers) before it reaches the model, as the spec's privacy section requires. The guard still sees the raw text, so a member's own amounts are allowed.

## Conventions every task follows

- Work in the worktree `/Users/gordon/Documents/Claude/mmfx-member-app-support-agent` (branch `support-agent`). Never touch the main checkout.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (AGENTS.md). Route handlers: `01-app/03-api-reference/03-file-conventions/route.md`; `after`: `01-app/03-api-reference/04-functions/after.md`.
- Server-only modules start with `import "server-only";`. vitest stubs it (see `vitest.config.ts`).
- Tests sit beside the code as `*.test.ts`. Run one file with `npx vitest run <path>`.
- Commits use `git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "..."`.
- The service-role client is `adminDb()` from `src/lib/channel/db.ts`. Admin checks use `supabase.rpc("is_admin")` from `src/lib/supabase/server.ts`.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/brokerRegion.ts` | Create | `Region`, `DUPOIN_COUNTRIES`, `regionFor()`, moved out of `upgrade/page.tsx` so server code can import them |
| `src/lib/brokerLinks.ts` | Create | Broker signup/change-partner links, IB number, switch reason, bot link, moved out of `UpgradeFlow.tsx` |
| `src/app/upgrade/page.tsx` | Modify | Import `regionFor` from `brokerRegion` |
| `src/app/upgrade/UpgradeFlow.tsx` | Modify | Import link constants from `brokerLinks`; re-export `Region` |
| `src/app/upgrade/DepositSubmitForm.tsx` | Modify | Step 1 copy: message Amelia only after the top-up |
| `supabase/migrations/20260915000010_support_agent.sql` | Create | `support_settings`, `support_chats`, `support_events`, RLS, seed row, 90-day purge job |
| `scripts/apply-support-agent-migration.mjs` | Create | Apply the migration via the pooler and prove RLS |
| `src/lib/support/types.ts` | Create | Shared types: `SupportSettings`, `ThreadMessage`, `MemberContext`, `Decision`, `FactSheet` |
| `src/lib/support/sendpulse.ts` | Create | SendPulse client: token, `getMessages`, `getContact`, `send`, `setTag`, `deleteTag`, `setPauseAutomation`, `openChat`, `runFlow` |
| `src/lib/support/facts.ts` | Create | Fact sheet text for the prompt, plus the guard allowlist |
| `src/lib/support/guard.ts` | Create | Pure draft checks and the always-handoff topics |
| `src/lib/support/member.ts` | Create | Reference code or Telegram handle → member context |
| `src/lib/support/agent.ts` | Create | Prompt, Claude call, decision parsing |
| `src/lib/support/run.ts` | Create | Orchestrates one burst: check → wait → gather → draft → guard → act → log |
| `src/app/api/support/webhook/route.ts` | Create | Secret check, event store, dedupe, `after(run)` |
| `src/app/admin/support/page.tsx` | Create | Switch, fact-sheet editor, Needs-Amelia queue, log, today's numbers |
| `src/app/admin/support/actions.ts` | Create | Server actions: save settings, toggle, clear a chat |
| `src/components/AppShell.tsx` | Modify | "Support Agent" in `ADMIN_NAV` |
| `src/app/api/cron/daily-stats/route.ts` | Modify | Support block in the 9am DM |
| `scripts/support-replay.mjs` | Create | Dry-run the pipeline over historical questions and write a report |

---

### Task 0: Worktree setup and dependencies

**Files:** Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install existing dependencies in the worktree**

```bash
cd /Users/gordon/Documents/Claude/mmfx-member-app-support-agent && npm ci
```
Expected: completes with no `ERR!`.

- [ ] **Step 2: Copy the env file so scripts and local runs work**

```bash
cp ../mmfx-member-app/.env.local .env.local
```
`.env.local` is gitignored. Check with `git check-ignore .env.local`, which should print the path.

- [ ] **Step 3: Add the SDK and zod**

```bash
npm install @anthropic-ai/sdk@^0.125.0 zod@^4.6.5
```

- [ ] **Step 4: Baseline**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: tsc exits 0 and all tests pass. If anything fails here, stop: the failure predates this work.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "chore(support-agent): add @anthropic-ai/sdk and zod"
```

---

### Task 1: Shared broker region and links

The agent's fact sheet must read broker routing and links from code, and server code can't import from a `"use client"` component or a page file.

**Files:**
- Create: `src/lib/brokerRegion.ts`, `src/lib/brokerRegion.test.ts`, `src/lib/brokerLinks.ts`
- Modify: `src/app/upgrade/page.tsx` (remove `DUPOIN_COUNTRIES` + `regionFor`, currently lines 27–51), `src/app/upgrade/UpgradeFlow.tsx` (the link constants, currently lines 13–19)

- [ ] **Step 1: Write the failing test**

`src/lib/brokerRegion.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { regionFor, DUPOIN_COUNTRIES } from "./brokerRegion";
import { OCTA_SIGNUP, IB_NUMBER, BOT_LINK } from "./brokerLinks";

describe("regionFor", () => {
  it("sends the US and UK to the contact path", () => {
    expect(regionFor("US")).toBe("contact");
    expect(regionFor("GB")).toBe("contact");
  });
  it("sends Dupoin countries to Dupoin", () => {
    for (const c of ["SG", "PH", "JP", "CA", "DE", "NO"]) expect(regionFor(c)).toBe("dupoin");
    expect(DUPOIN_COUNTRIES.has("MY")).toBe(false);
  });
  it("sends everyone else, including unknown, to Octa/Elev8", () => {
    expect(regionFor("MY")).toBe("octa");
    expect(regionFor("NG")).toBe("octa");
    expect(regionFor("")).toBe("octa");
  });
});

describe("brokerLinks", () => {
  it("the Octa signup link carries our IB", () => {
    expect(IB_NUMBER).toBe("47807426");
    expect(OCTA_SIGNUP).toContain(`ib=${IB_NUMBER}`);
  });
  it("the bot link opens @marketmakers18bot", () => {
    expect(BOT_LINK).toBe("https://t.me/marketmakers18bot");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/brokerRegion.test.ts`
Expected: FAIL, `Cannot find module './brokerRegion'`.

- [ ] **Step 3: Create the modules**

`src/lib/brokerRegion.ts`:
```ts
// Geo-routing for the broker funnel (see memory mmfx-broker-funnel): US/UK go to
// the contact (lifetime plans) path, a fixed list of countries to Dupoin, and
// everyone else, including unknown, to Octa/Elev8. Shared by /upgrade and the
// support agent's fact sheet.

export type Region = "octa" | "dupoin" | "contact";

// Dupoin countries: Canada, the EU/EEA member states, Iran, Israel, Japan,
// Myanmar, New Zealand, North Korea, the Philippines, Singapore.
export const DUPOIN_COUNTRIES: ReadonlySet<string> = new Set<string>([
  "CA", // Canada
  // EU member states
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA (non-EU) member states
  "IS", "LI", "NO",
  "IR", // Iran
  "IL", // Israel
  "JP", // Japan
  "MM", // Myanmar
  "NZ", // New Zealand
  "KP", // North Korea
  "PH", // The Philippines
  "SG", // Singapore
]);

export function regionFor(country: string): Region {
  if (country === "US" || country === "GB") return "contact";
  if (DUPOIN_COUNTRIES.has(country)) return "dupoin";
  return "octa";
}
```

`src/lib/brokerLinks.ts`:
```ts
// Broker funnel links (see memory mmfx-broker-funnel). Shared by the /upgrade
// flow and the support agent, so there is one copy of every link and number.

export const IB_NUMBER = "47807426";
export const OCTA_SIGNUP = `https://clickto.trade/bT8tAZDKvQY?ib=${IB_NUMBER}`;
export const DUPOIN_SIGNUP = "https://dupoin.me/ett5od077";
export const OCTA_CHANGE_IB = "https://my.octabroker.com/change-partner-request/";
export const ELEV8_CHANGE_IB = "https://my.elev8.com/change-partner-request/";
export const SWITCH_REASON = "They are assisting me in my trading with signals and analysis.";
/** Opens @marketmakers18bot, where the Welcome and Join/SignUp flows take over. */
export const BOT_LINK = "https://t.me/marketmakers18bot";
```

- [ ] **Step 4: Point the upgrade page at the shared module**

In `src/app/upgrade/page.tsx`, delete the block from the `// Dupoin countries:` comment through the closing `}` of `regionFor` (the exact text shown in Step 3's `brokerRegion.ts`, minus `export`). Add this import beside the other `@/lib` imports:
```ts
import { regionFor } from "@/lib/brokerRegion";
```
Keep `import { UpgradeFlow, type Region } from "./UpgradeFlow";` unchanged. Step 5 re-exports `Region`.

- [ ] **Step 5: Point UpgradeFlow at the shared links**

In `src/app/upgrade/UpgradeFlow.tsx`, replace these five lines:
```ts
const OCTA_SIGNUP = "https://clickto.trade/bT8tAZDKvQY?ib=47807426";
const DUPOIN_SIGNUP = "https://dupoin.me/ett5od077";
const OCTA_CHANGE_IB = "https://my.octabroker.com/change-partner-request/";
const ELEV8_CHANGE_IB = "https://my.elev8.com/change-partner-request/";
const IB_NUMBER = "47807426";
const SWITCH_REASON = "They are assisting me in my trading with signals and analysis.";
```
with:
```ts
import {
  OCTA_SIGNUP, DUPOIN_SIGNUP, OCTA_CHANGE_IB, ELEV8_CHANGE_IB, IB_NUMBER, SWITCH_REASON,
} from "@/lib/brokerLinks";
```
(move the `import` up with the other imports), and replace `export type Region = "octa" | "dupoin" | "contact";` with:
```ts
export type { Region } from "@/lib/brokerRegion";
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run src/lib/brokerRegion.test.ts && npx tsc --noEmit`
Expected: PASS, and tsc exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/brokerRegion.ts src/lib/brokerRegion.test.ts src/lib/brokerLinks.ts src/app/upgrade/page.tsx src/app/upgrade/UpgradeFlow.tsx
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "refactor(upgrade): move broker region + links into shared lib modules"
```

---

### Task 2: Database — support tables, RLS, seed, purge

**Files:**
- Create: `supabase/migrations/20260915000010_support_agent.sql`, `scripts/apply-support-agent-migration.mjs`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260915000010_support_agent.sql`:
```sql
-- ============================================================================
-- Support agent (spec 2026-09-15-support-agent-design.md).
--   support_settings : one row, the on/off switch + facts editable in /admin
--   support_chats    : one row per SendPulse contact, the agent's per-chat state
--   support_events   : the log, purged after 90 days
-- RLS: admins may SELECT; all writes go through the service role (route + server
-- actions after an is_admin() check). anon gets nothing.
-- ============================================================================

create table if not exists public.support_settings (
  id                 smallint primary key default 1 check (id = 1),
  enabled            boolean     not null default false,
  bonus_code         text        not null default 'TeamMM001',
  bonus_code_expires date        not null default date '2026-12-15',
  official_accounts  jsonb       not null default '[
    {"handle":"MM_3000","label":"Admin Amelia, the admin"},
    {"handle":"MMFX_BOSS","label":"Gordon''s personal line"},
    {"handle":"marketmakers18bot","label":"the MMFX bot"}
  ]'::jsonb,
  office_hours       text        not null default 'during Singapore office hours',
  trade_cadence      text        not null default 'around 2–3 trades a day',
  notes              text        not null default '',
  approved_flows     jsonb       not null default '[
    {"label":"MMFX bot (sign-up flows)","link":"https://t.me/marketmakers18bot",
     "use_when":"someone wants to join or sign up, especially in @MM_3000 chats"}
  ]'::jsonb,
  updated_by         uuid        references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now()
);
insert into public.support_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.support_chats (
  contact_id          text        primary key,
  is_business         boolean     not null default false,
  telegram_username   text,
  matched_user_id     uuid        references public.profiles(id) on delete set null,
  state               text        not null default 'auto'
                                  check (state in ('auto', 'quiet', 'needs_amelia')),
  quiet_until         timestamptz,
  handoff_reason      text,
  last_member_msg_at  timestamptz,
  last_agent_reply_at timestamptz,
  updated_at          timestamptz not null default now()
);
create index if not exists support_chats_state_idx on public.support_chats (state, updated_at desc);

create table if not exists public.support_events (
  id              bigint generated always as identity primary key,
  contact_id      text        not null,
  kind            text        not null
                  check (kind in ('incoming', 'reply', 'handoff', 'skip', 'error', 'amelia_reply')),
  dedupe_key      text        unique,
  member_text     text,
  topic           text,
  confidence      numeric(3,2),
  reply_text      text,
  skip_reason     text,
  guard_failures  jsonb,
  model           text,
  latency_ms      integer,
  created_at      timestamptz not null default now()
);
create index if not exists support_events_contact_idx on public.support_events (contact_id, created_at desc);
create index if not exists support_events_created_idx on public.support_events (created_at desc);

alter table public.support_settings enable row level security;
alter table public.support_chats    enable row level security;
alter table public.support_events   enable row level security;

revoke all on public.support_settings, public.support_chats, public.support_events from anon, authenticated;
grant select on public.support_settings, public.support_chats, public.support_events to authenticated;

create policy "support_settings_select_admin" on public.support_settings
  for select to authenticated using ( public.is_admin() );
create policy "support_chats_select_admin" on public.support_chats
  for select to authenticated using ( public.is_admin() );
create policy "support_events_select_admin" on public.support_events
  for select to authenticated using ( public.is_admin() );

-- 90-day retention for the log (member message text lives here).
select cron.schedule(
  'support-events-purge',
  '30 0 * * *',
  $$delete from public.support_events where created_at < now() - interval '90 days'$$
);
```

- [ ] **Step 2: Write the apply script**

`scripts/apply-support-agent-migration.mjs`:
```js
// One-off: apply 20260915000010_support_agent.sql via the IPv4 pooler, then prove
// the tables, the seed row, RLS (anon and a non-admin see nothing) and the purge job.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(
  new URL("../supabase/migrations/20260915000010_support_agent.sql", import.meta.url), "utf8"
);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});

let failed = false;
const ok = (label, cond, detail = "") => {
  if (!cond) failed = true;
  console.log(`${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  const s = (await client.query("select enabled, bonus_code, bonus_code_expires::text d from public.support_settings where id = 1")).rows[0];
  ok("seed row exists, switch off", s && s.enabled === false, JSON.stringify(s));
  ok("bonus code seeded", s?.bonus_code === "TeamMM001" && s?.d === "2026-12-15");

  const rls = (await client.query(
    `select relname, relrowsecurity from pg_class
      where relname in ('support_settings','support_chats','support_events')`)).rows;
  ok("RLS on all three tables", rls.length === 3 && rls.every((r) => r.relrowsecurity));

  await client.query("begin");
  await client.query("set local role anon");
  let anonBlocked = false;
  try { await client.query("select 1 from public.support_events limit 1"); } catch { anonBlocked = true; }
  await client.query("rollback");
  ok("anon cannot read support_events", anonBlocked);

  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query(`select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true)`);
  const seen = (await client.query("select count(*)::int n from public.support_settings")).rows[0].n;
  await client.query("rollback");
  ok("a non-admin sees no settings row", seen === 0, `rows=${seen}`);

  const job = (await client.query("select schedule from cron.job where jobname = 'support-events-purge'")).rows[0];
  ok("purge job scheduled daily", job?.schedule === "30 0 * * *");
} catch (e) {
  failed = true;
  console.error(e);
  await client.query("rollback").catch(() => {});
} finally {
  await client.end();
  process.exit(failed ? 1 : 0);
}
```

- [ ] **Step 3: Apply to prod and verify**

Run: `node scripts/apply-support-agent-migration.mjs`
Expected: `migration applied`, then six `ok` lines and exit 0. Applying early is safe: the switch defaults to off and nothing reads these tables yet.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915000010_support_agent.sql scripts/apply-support-agent-migration.mjs
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): support_settings/chats/events tables, RLS, 90-day purge"
```

---

### Task 3: Shared types and the SendPulse client

**Files:**
- Create: `src/lib/support/types.ts`, `src/lib/support/sendpulse.ts`, `src/lib/support/sendpulse.test.ts`

The SendPulse API facts behind this client, verified 15 Sept against the live account:
- Paging uses `skip=` (`page=` is ignored).
- `/telegram/chats/messages?contact_id=` returns **newest first**.
- `direction` is 1 for the member and 2 for outgoing.
- Flow and broadcast messages carry `block_id`, `send_block_id`, `chain_id` or `campaign_id`.
- `sent_by` is always null.
- The write endpoints (`send`, `setTag`, `deleteTag`, `setPauseAutomation`, `openChat`, `flows/run`) all exist. Each returns 400 "Contact does not exist" for an unknown id.

- [ ] **Step 1: Create the shared types**

`src/lib/support/types.ts`:
```ts
import type { MemberTier } from "@/lib/tiers";

export interface OfficialAccount { handle: string; label: string }
export interface ApprovedFlow { label: string; link?: string; flow_id?: string; use_when: string }

/** The support_settings row (id = 1). */
export interface SupportSettings {
  enabled: boolean;
  bonus_code: string;
  bonus_code_expires: string; // YYYY-MM-DD
  official_accounts: OfficialAccount[];
  office_hours: string;
  trade_cadence: string;
  notes: string;
  approved_flows: ApprovedFlow[];
}

/** One message in a SendPulse thread, oldest-first once normalised. */
export interface ThreadMessage {
  id: string;
  direction: "in" | "out";
  /** Sent by a SendPulse flow, trigger or broadcast (not a person, not the agent). */
  fromFlow: boolean;
  text: string;
  at: string; // ISO timestamp
}

export interface ContactInfo {
  id: string;
  username: string | null;
  firstName: string;
  /** Arrived through Admin Amelia's account (Telegram Business). */
  isBusiness: boolean;
  tags: string[];
}

export interface MemberContext {
  userId: string;
  matchedBy: "ref" | "handle";
  tier: MemberTier;
  trialEndsAt: string | null;
  submission: { status: "pending" | "verified" | "rejected"; rejectReason: string | null; createdAt: string } | null;
}

export const TOPICS = [
  "join", "plans", "deposit", "broker", "switch_ib", "bonus", "trial", "login", "access",
  "team_mm", "indicators", "lifetime", "official_accounts", "reference_code", "greeting",
  "money", "complaint", "deletion", "other",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface Decision {
  action: "reply" | "handoff";
  topic: Topic;
  confidence: number; // 0..1
  reply: string;
  reason: string;
}

export interface FactSheet {
  /** The facts block placed in the system prompt. */
  text: string;
  allow: {
    amounts: Set<number>;
    urls: string[];
    appPaths: string[];
    handles: Set<string>; // lowercase, no @
    ibNumber: string;
    /** Null when there is no current code (expired). */
    bonusCode: string | null;
    flowIds: Set<string>;
  };
}
```

- [ ] **Step 2: Write the failing test**

`src/lib/support/sendpulse.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMessages, getContact, send, __resetTokenForTests } from "./sendpulse";

type Call = { url: string; init?: RequestInit };
let calls: Call[];

function mockFetch(routes: (url: string, init?: RequestInit) => Response) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return routes(url, init);
  }));
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

beforeEach(() => {
  process.env.SENDPULSE_API_ID = "id";
  process.env.SENDPULSE_API_SECRET = "secret";
  __resetTokenForTests();
});

describe("getMessages", () => {
  it("returns the latest N oldest-first, flags flow messages", async () => {
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "T", expires_in: 3600 });
      return json({ data: [
        { id: "m3", direction: 2, block_id: "b1", created_at: "2026-09-15T10:00:03Z", data: { text: "Where are you based?" } },
        { id: "m2", direction: 1, created_at: "2026-09-15T10:00:02Z", data: { text: "Malaysia" } },
        { id: "m1", direction: 2, created_at: "2026-09-15T10:00:01Z", data: { text: "Hi!" } },
      ], meta: { total: 3 } });
    });
    const msgs = await getMessages("c1", 2);
    expect(msgs.map((m) => m.id)).toEqual(["m2", "m3"]);
    expect(msgs[0]).toMatchObject({ direction: "in", fromFlow: false, text: "Malaysia" });
    expect(msgs[1]).toMatchObject({ direction: "out", fromFlow: true });
    expect(calls[1].url).toContain("contact_id=c1");
  });

  it("refreshes the token once on 401", async () => {
    let n = 0;
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: `T${++n}`, expires_in: 3600 });
      const auth = (calls.at(-1)!.init!.headers as Record<string, string>).Authorization;
      return auth === "Bearer T1" ? json({}, 401) : json({ data: [], meta: { total: 0 } });
    });
    await expect(getMessages("c1")).resolves.toEqual([]);
    expect(n).toBe(2);
  });
});

describe("getContact", () => {
  it("normalises username, business flag and tags", async () => {
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "T", expires_in: 3600 });
      return json({ data: { id: "c1", channel_data: { username: "Sam_T", first_name: "Sam" },
        business_connection: { id: "b" }, tags: [{ name: "country_UK/USA" }, "capital_under100"] } });
    });
    await expect(getContact("c1")).resolves.toEqual({
      id: "c1", username: "Sam_T", firstName: "Sam", isBusiness: true, tags: ["country_UK/USA", "capital_under100"],
    });
  });
});

describe("send", () => {
  it("posts a text message and reports success", async () => {
    mockFetch((url) => {
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "T", expires_in: 3600 });
      return json({ success: true });
    });
    await expect(send("c1", "hello")).resolves.toBe(true);
    const body = JSON.parse(String(calls[1].init!.body));
    expect(body).toEqual({ contact_id: "c1", message: { type: "text", text: "hello" } });
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/sendpulse.test.ts`
Expected: FAIL, `Cannot find module './sendpulse'`.

- [ ] **Step 4: Implement the client**

`src/lib/support/sendpulse.ts`:
```ts
import "server-only";
import type { ContactInfo, ThreadMessage } from "./types";

// Thin SendPulse Chatbots API client for the support agent (Telegram only).
// Uses SENDPULSE_API_ID / SENDPULSE_API_SECRET (already set for email).

const BASE = "https://api.sendpulse.com";
let token: { value: string; expiresAt: number } | null = null;

export function __resetTokenForTests() { token = null; }

async function getToken(force = false): Promise<string> {
  if (!force && token && Date.now() < token.expiresAt) return token.value;
  const r = await fetch(`${BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SENDPULSE_API_ID,
      client_secret: process.env.SENDPULSE_API_SECRET,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("SendPulse auth failed");
  token = { value: j.access_token, expiresAt: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000 };
  return token.value;
}

async function sp(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}, attempt = 0): Promise<{ status: number; json: any }> {
  const r = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await getToken(attempt > 0 && attempt < 2)}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (r.status === 401 && attempt === 0) return sp(path, init, 1);
  if ((r.status === 429 || r.status >= 500) && attempt < 2) {
    await new Promise((res) => setTimeout(res, 1000));
    return sp(path, init, 2);
  }
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

function toMessage(m: any): ThreadMessage {
  const d = m?.data ?? {};
  const text = typeof d.text === "string" ? d.text : typeof d.caption === "string" ? d.caption : "";
  return {
    id: String(m.id),
    direction: m.direction === 1 ? "in" : "out",
    fromFlow: Boolean(m.block_id || m.send_block_id || m.chain_id || m.campaign_id),
    text,
    at: String(m.created_at),
  };
}

/** The latest `limit` messages, oldest first. The API returns newest first. */
export async function getMessages(contactId: string, limit = 15): Promise<ThreadMessage[]> {
  const { json } = await sp(`/telegram/chats/messages?contact_id=${encodeURIComponent(contactId)}`);
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  return rows.slice(0, limit).map(toMessage).reverse();
}

export async function getContact(contactId: string): Promise<ContactInfo | null> {
  const { status, json } = await sp(`/telegram/contacts/get?id=${encodeURIComponent(contactId)}`);
  const c = json?.data;
  if (status !== 200 || !c) return null;
  const cd = c.channel_data ?? {};
  return {
    id: String(c.id),
    username: cd.username ?? null,
    firstName: cd.first_name ?? "",
    isBusiness: Boolean(c.business_connection),
    tags: (Array.isArray(c.tags) ? c.tags : []).map((t: any) => (typeof t === "string" ? t : t?.name)).filter(Boolean),
  };
}

const post = async (path: string, body: unknown) => (await sp(path, { method: "POST", body })).status === 200;

export const send = (contactId: string, text: string) =>
  post("/telegram/contacts/send", { contact_id: contactId, message: { type: "text", text } });
export const setTag = (contactId: string, tag: string) =>
  post("/telegram/contacts/setTag", { contact_id: contactId, tags: [tag] });
export const deleteTag = (contactId: string, tag: string) =>
  post("/telegram/contacts/deleteTag", { contact_id: contactId, tag });
export const setPauseAutomation = (contactId: string, minutes: number) =>
  post("/telegram/contacts/setPauseAutomation", { contact_id: contactId, minutes });
export const openChat = (contactId: string) =>
  post("/telegram/contacts/openChat", { contact_id: contactId });
export const runFlow = (contactId: string, flowId: string) =>
  post("/telegram/flows/run", { contact_id: contactId, flow_id: flowId });
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/support/sendpulse.test.ts && npx tsc --noEmit`
Expected: 4 tests PASS, and tsc exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/support/types.ts src/lib/support/sendpulse.ts src/lib/support/sendpulse.test.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): shared types + SendPulse chatbot client"
```

---

### Task 4: The fact sheet (`facts.ts`)

Prices, tiers, features, links and the IB are **read from code**. Only the `support_settings` values are editable.

**Files:**
- Create: `src/lib/support/facts.ts`, `src/lib/support/facts.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/support/facts.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildFactSheet, TRIAL_DAYS } from "./facts";
import type { SupportSettings } from "./types";
import { TIER_THRESHOLDS } from "@/lib/tiers";
import { LIFETIME_PLANS } from "@/lib/lifetimePlans";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }, { handle: "MMFX_BOSS", label: "Gordon" }],
  office_hours: "during Singapore office hours", trade_cadence: "around 2–3 trades a day", notes: "",
  approved_flows: [{ label: "bot", link: "https://t.me/marketmakersfx18bot_not_real", use_when: "x" },
                   { label: "join flow", flow_id: "69d626007041a05eea073a86", use_when: "y" }],
};
const NOW = new Date("2026-09-15T04:00:00Z");

describe("buildFactSheet", () => {
  const f = buildFactSheet(settings, NOW);

  it("allows exactly the tier thresholds and plan prices from code", () => {
    for (const v of Object.values(TIER_THRESHOLDS)) expect(f.allow.amounts.has(v)).toBe(true);
    for (const p of Object.values(LIFETIME_PLANS)) expect(f.allow.amounts.has(p.priceUsd)).toBe(true);
    expect(f.allow.amounts.has(100)).toBe(false);
    expect(f.allow.amounts.has(388)).toBe(false);
  });

  it("states the live numbers in the prompt text", () => {
    expect(f.text).toContain("$50");
    expect(f.text).toContain("$200");
    expect(f.text).toContain("$500");
    expect(f.text).toContain("USD 588");
    expect(f.text).toContain("USD 1,588");
    expect(f.text).toContain(`${TRIAL_DAYS} days`);
    expect(f.text).toContain("47807426");
    expect(f.text).toContain("@MM_3000");
  });

  it("lists approved flow links and ids", () => {
    expect(f.allow.urls).toContain("https://t.me/marketmakersfx18bot_not_real");
    expect(f.allow.flowIds.has("69d626007041a05eea073a86")).toBe(true);
  });

  it("carries the bonus code while it's valid, and drops it after expiry", () => {
    expect(f.allow.bonusCode).toBe("TeamMM001");
    expect(buildFactSheet(settings, new Date("2026-12-16T00:00:00Z")).allow.bonusCode).toBeNull();
  });

  it("allows the official handles only", () => {
    expect([...f.allow.handles].sort()).toEqual(["marketmakers18bot", "mm_3000", "mmfx_boss"]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/facts.test.ts`
Expected: FAIL, `Cannot find module './facts'`.

- [ ] **Step 3: Implement the fact sheet**

`src/lib/support/facts.ts`:
```ts
import { TIER_THRESHOLDS } from "@/lib/tiers";
import { FEATURE_MIN_TIER } from "@/lib/access/features";
import { LIFETIME_PLANS, LIFETIME_PLAN_ORDER } from "@/lib/lifetimePlans";
import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_HANDLE, ADMIN_TELEGRAM_URL } from "@/lib/depositRef";
import {
  BOT_LINK, DUPOIN_SIGNUP, ELEV8_CHANGE_IB, IB_NUMBER, OCTA_CHANGE_IB, OCTA_SIGNUP, SWITCH_REASON,
} from "@/lib/brokerLinks";
import type { FactSheet, SupportSettings } from "./types";

/** New-signup trial length. Source of truth: handle_new_user (supabase/migrations). */
export const TRIAL_DAYS = 14;

const APP = "https://app.marketmakersfx.net";
const APP_PATHS = ["/", "/signup", "/login", "/upgrade", "/indicators", "/team-mm", "/course", "/daily-analysis"];

type FeatureKey = keyof typeof FEATURE_MIN_TIER;
const FEATURE_LABEL: Record<FeatureKey, string> = {
  calendar: "Economic Calendar",
  news: "News",
  "know-your-style": "Know Your Style",
  "daily-analysis": "Daily Analysis",
  course: "the course (Module 1 on Free; all 19 lessons from Foundation)",
  library: "the MM Library",
  indicators: "the TradingView indicators",
  strategies: "the strategy scripts",
  signals: "the signals channel",
  "live-classes": "Live Classes",
  "fundamental-desk": "the Fundamental Desk",
  "ai-trading-assistant": "the AI Trading Assistant",
  "team-mm": "the private Team MM channel",
};

function featuresFor(tier: "free" | "foundation" | "desk" | "team"): string {
  return (Object.keys(FEATURE_MIN_TIER) as FeatureKey[])
    .filter((k) => FEATURE_MIN_TIER[k] === tier).map((k) => FEATURE_LABEL[k]).join(", ");
}

const usd = (n: number) => `USD ${n.toLocaleString("en-US")}`;

export function buildFactSheet(s: SupportSettings, now: Date = new Date()): FactSheet {
  const today = now.toISOString().slice(0, 10);
  const bonusCode = s.bonus_code && today <= s.bonus_code_expires ? s.bonus_code : null;
  const plans = LIFETIME_PLAN_ORDER.map((p) => `${LIFETIME_PLANS[p].name} ${usd(LIFETIME_PLANS[p].priceUsd)}`).join(" and ");
  const flows = s.approved_flows.map((f) => `- ${f.label}${f.link ? `: ${f.link}` : ""}. Use when ${f.use_when}.`).join("\n");

  const text = [
    "PLANS (tiers count cumulative verified deposits into the member's own trading account, never balance; every top-up counts toward the next tier; there is no fee and the money stays theirs):",
    `- Free (after the trial): ${featuresFor("free")}.`,
    `- Foundation, from $${TIER_THRESHOLDS.foundation}: adds ${featuresFor("foundation")}.`,
    `- Desk, from $${TIER_THRESHOLDS.desk}: adds ${featuresFor("desk")}.`,
    `- Team MM, from $${TIER_THRESHOLDS.team}: adds ${featuresFor("team")}.`,
    `TRIAL: ${TRIAL_DAYS} days for new signups. Someone who deposits during the trial keeps full trial access until it ends, then drops to the tier their deposits reached.`,
    `US AND UK: partner brokers can't take them. Two lifetime plans, paid once: ${plans}. Payment is arranged in chat on the upgrade page.`,
    `BROKERS: ${APP}/upgrade detects the member's country and shows the right broker: Octa or Elev8 for most countries; Dupoin for Canada, the EU/EEA, Japan, New Zealand, the Philippines, Singapore and a few others.`,
    `HOW TO JOIN, always in this order: 1) open an account through the upgrade page (Octa: ${OCTA_SIGNUP}, Dupoin: ${DUPOIN_SIGNUP}); 2) top up from $${TIER_THRESHOLDS.foundation}; 3) only after the top-up, message ${ADMIN_DISPLAY_NAME} (@${ADMIN_TELEGRAM_HANDLE}) with the reference code shown on the upgrade page (MM- plus 6 characters); 4) submit the deposit details on the upgrade page (broker, account number, amount, screenshot, TradingView and Telegram usernames); 5) the team checks it and emails them when it's approved. Never tell anyone to message ${ADMIN_DISPLAY_NAME} before topping up.`,
    `ALREADY WITH OCTA OR ELEV8: keep the account and switch partner: Octa ${OCTA_CHANGE_IB} or Elev8 ${ELEV8_CHANGE_IB}, IB number ${IB_NUMBER}, reason "${SWITCH_REASON}". Then hold at least $${TIER_THRESHOLDS.foundation} and submit on the upgrade page. Existing Dupoin clients send ${ADMIN_DISPLAY_NAME} their full name and Dupoin UID.`,
    `BONUS: Dupoin's 100% deposit bonus is shown in the app. ${bonusCode ? `Octa/Elev8 bonus code: ${bonusCode} (valid until ${s.bonus_code_expires}).` : "There is no Octa/Elev8 bonus code right now; hand off bonus-code requests."}`,
    `LINKS YOU MAY USE: ${APP_PATHS.filter((p) => p !== "/").map((p) => APP + p).join(", ")}, ${ADMIN_TELEGRAM_URL}.`,
    `APPROVED FLOW LINKS:\n${flows || "- none"}`,
    `OFFICIAL ACCOUNTS: ${s.official_accounts.map((a) => `@${a.handle} (${a.label})`).join(", ")}. Staff never ask for passwords or ask anyone to send money to a person.`,
    `HUMAN REPLIES: ${s.office_hours}. TRADE CADENCE: ${s.trade_cadence}.`,
    s.notes ? `NOTES: ${s.notes}` : "",
  ].filter(Boolean).join("\n");

  const urls = [OCTA_SIGNUP, DUPOIN_SIGNUP, OCTA_CHANGE_IB, ELEV8_CHANGE_IB, ADMIN_TELEGRAM_URL, BOT_LINK,
    ...s.approved_flows.map((f) => f.link).filter((l): l is string => Boolean(l))];

  return {
    text,
    allow: {
      amounts: new Set<number>([...Object.values(TIER_THRESHOLDS), ...LIFETIME_PLAN_ORDER.map((p) => LIFETIME_PLANS[p].priceUsd)]),
      urls,
      appPaths: APP_PATHS,
      handles: new Set([...s.official_accounts.map((a) => a.handle.toLowerCase()), "marketmakers18bot"]),
      ibNumber: IB_NUMBER,
      bonusCode,
      flowIds: new Set(s.approved_flows.map((f) => f.flow_id).filter((x): x is string => Boolean(x))),
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/support/facts.test.ts && npx tsc --noEmit`
Expected: 5 tests PASS, and tsc exits 0. If tsc reports a missing key in `FEATURE_LABEL`, a feature was added to `features.ts`: add its label. That's the point of typing the map.

- [ ] **Step 5: Commit**

```bash
git add src/lib/support/facts.ts src/lib/support/facts.test.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): fact sheet built from code constants + settings"
```

---

### Task 5: The guard (`guard.ts`)

**Files:**
- Create: `src/lib/support/guard.ts`, `src/lib/support/guard.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/support/guard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkDraft, mustHandOff, MAX_REPLY_CHARS } from "./guard";
import { buildFactSheet } from "./facts";
import type { MemberContext, SupportSettings } from "./types";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }, { handle: "MMFX_BOSS", label: "Gordon" }],
  office_hours: "x", trade_cadence: "y", notes: "", approved_flows: [],
};
const facts = buildFactSheet(settings, new Date("2026-09-15T04:00:00Z"));
const ctx = (memberTexts: string[] = [], member: MemberContext | null = null) => ({ facts, memberTexts, member });

describe("checkDraft", () => {
  it("passes a clean, correct reply", () => {
    expect(checkDraft("Foundation starts at $50, Desk at $200 and Team MM at $500. Start at https://app.marketmakersfx.net/upgrade", ctx())).toEqual([]);
  });
  it("blocks an amount that isn't on the fact sheet", () => {
    expect(checkDraft("The minimum is USD100.", ctx())).toEqual([expect.stringContaining("amount")]);
  });
  it("allows an amount the member wrote themselves", () => {
    expect(checkDraft("Your $198 counts toward Foundation.", ctx(["I have $198 in my account"]))).toEqual([]);
  });
  it("blocks a wrong IB number", () => {
    expect(checkDraft("Use IB 5928887.", ctx())).toEqual([expect.stringContaining("IB")]);
  });
  it("blocks a stale or unknown bonus code", () => {
    expect(checkDraft("Use code TeamMM002.", ctx())).toEqual([expect.stringContaining("bonus")]);
    expect(checkDraft("Use code TeamMM001.", ctx())).toEqual([]);
  });
  it("blocks links that aren't allowed", () => {
    expect(checkDraft("Fill this form https://forms.gle/abc", ctx())).toEqual([expect.stringContaining("link")]);
    expect(checkDraft("Sign up at clickto.trade/bIyal89D7os?ib=5928887", ctx())).toEqual(
      expect.arrayContaining([expect.stringContaining("link")]));
  });
  it("blocks unofficial handles", () => {
    expect(checkDraft("Message @randomguy", ctx())).toEqual([expect.stringContaining("@randomguy")]);
    expect(checkDraft("Message @MM_3000", ctx())).toEqual([]);
  });
  it("blocks profit language", () => {
    expect(checkDraft("Let's start printing together!", ctx())).toEqual([expect.stringContaining("profit")]);
  });
  it("blocks a deposit-approved claim without a verified submission", () => {
    expect(checkDraft("Your deposit is approved.", ctx())).toEqual([expect.stringContaining("deposit")]);
    const verified: MemberContext = { userId: "u", matchedBy: "ref", tier: "foundation", trialEndsAt: null,
      submission: { status: "verified", rejectReason: null, createdAt: "2026-09-14" } };
    expect(checkDraft("Your deposit is approved.", ctx([], verified))).toEqual([]);
  });
  it("blocks replies over the length limit", () => {
    expect(checkDraft("a".repeat(MAX_REPLY_CHARS + 1), ctx())).toEqual([expect.stringContaining("long")]);
  });
});

describe("mustHandOff", () => {
  it("hands off money, disputes and deletion whatever the draft", () => {
    expect(mustHandOff("How do I withdraw my money?", "other")).toMatch(/withdraw/);
    expect(mustHandOff("I paid USD 588 yesterday, where is my access?", "lifetime")).toMatch(/payment/);
    expect(mustHandOff("This is a scam, I'll report you", "complaint")).toBeTruthy();
    expect(mustHandOff("please delete my account", "deletion")).toBeTruthy();
  });
  it("leaves ordinary questions alone", () => {
    expect(mustHandOff("How much do I need to deposit?", "plans")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/guard.test.ts`
Expected: FAIL, `Cannot find module './guard'`.

- [ ] **Step 3: Implement the guard**

`src/lib/support/guard.ts`:
```ts
import type { FactSheet, MemberContext, Topic } from "./types";

// Pure checks on a drafted reply. An empty array means it may be sent. Every
// failure is a short reason, fed back to the model for one redraft.

export const MAX_REPLY_CHARS = 900;

const AMOUNT_RE = /(?:\$|us\$|usd\s?)\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:usd|dollars?)\b/gi;
const IB_RE = /\b\d{6,9}\b/g;
const BONUS_RE = /\bteam\s?mm\d+\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s)>\]]+|\b(?:app\.marketmakersfx\.net|t\.me|dupoin\.me|clickto\.trade|my\.octabroker\.com|my\.elev8\.com|forms\.gle|docs\.google\.com|wa\.me)\/[^\s)>\]]*/gi;
const HANDLE_RE = /(^|[^\w@])@([A-Za-z0-9_]{3,32})/g;
const PROFIT_RE = /\b(guarantee[ds]?|profits?|profitable|returns|printing|make money|risk[- ]free|double (?:your|the))\b/i;
const DEPOSIT_CLAIM_RE = /(deposit|top-?up|submission)[^.!?\n]{0,60}\b(approved|verified|confirmed|received)\b|\b(approved|verified|confirmed|received)\b[^.!?\n]{0,60}(deposit|top-?up|submission)/i;

function amounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const n = Number((m[1] ?? m[2] ?? "").replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function normaliseUrl(u: string): string {
  const trimmed = u.replace(/[.,!?;:'"]+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function urlAllowed(u: string, facts: FactSheet): boolean {
  if (facts.allow.urls.includes(u)) return true;
  const app = "https://app.marketmakersfx.net";
  if (u === app || u === `${app}/`) return true;
  if (u.startsWith(app)) {
    const path = u.slice(app.length).split(/[?#]/)[0];
    return facts.allow.appPaths.includes(path);
  }
  return false;
}

export function checkDraft(
  draft: string,
  ctx: { facts: FactSheet; memberTexts: string[]; member: MemberContext | null }
): string[] {
  const f = ctx.facts;
  const fails: string[] = [];

  const memberAmounts = new Set(ctx.memberTexts.flatMap((t) => [...amounts(t), ...(t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => Number(x.replace(/,/g, "")))]));
  const bad = amounts(draft).filter((n) => !f.allow.amounts.has(n) && !memberAmounts.has(n));
  if (bad.length) fails.push(`amount not on the fact sheet: ${bad.join(", ")}`);

  const ibs = (draft.match(IB_RE) ?? []).filter((n) => n !== f.allow.ibNumber);
  if (ibs.length) fails.push(`IB-style number not ours: ${ibs.join(", ")} (only ${f.allow.ibNumber})`);

  for (const code of draft.match(BONUS_RE) ?? []) {
    const ok = f.allow.bonusCode && code.replace(/\s/g, "").toLowerCase() === f.allow.bonusCode.toLowerCase();
    if (!ok) fails.push(`bonus code not current: ${code}`);
  }

  const badUrls = (draft.match(URL_RE) ?? []).map(normaliseUrl).filter((u) => !urlAllowed(u, f));
  if (badUrls.length) fails.push(`link not allowed: ${badUrls.join(", ")}`);

  for (const m of draft.matchAll(HANDLE_RE)) {
    if (!f.allow.handles.has(m[2].toLowerCase())) fails.push(`handle not official: @${m[2]}`);
  }

  if (PROFIT_RE.test(draft)) fails.push("profit or return language");

  if (DEPOSIT_CLAIM_RE.test(draft) && ctx.member?.submission?.status !== "verified") {
    fails.push("claims a deposit is received or approved without a verified submission");
  }

  if (draft.length > MAX_REPLY_CHARS) fails.push(`too long (${draft.length} > ${MAX_REPLY_CHARS})`);
  return fails;
}

const ALWAYS_HUMAN: [RegExp, string][] = [
  [/\bwithdraw(al|ing)?\b/i, "withdrawal"],
  [/\b(refund|chargeback)\b/i, "refund"],
  [/\b(i|we)\s+(have\s+)?(paid|transferred|sent (the )?money)\b/i, "payment already made"],
  [/\b(missing|lost|stuck|disappeared)\b[^.!?]{0,40}\b(funds?|money|deposit|balance)\b|\b(funds?|money|deposit)\b[^.!?]{0,40}\b(not (arrived|received|showing|reflected)|missing)\b/i, "missing or pending funds"],
  [/\b(scam|fraud|lawyer|police|sue|report you|complain(t)?)\b/i, "dispute or complaint"],
  [/\bdelete (my )?(account|data)\b|\bremove my (account|data)\b/i, "account deletion"],
];
const HUMAN_TOPICS: Partial<Record<Topic, string>> = { money: "money topic", complaint: "dispute or complaint", deletion: "account deletion" };

/** A reason when the member's message must go to a human regardless of the draft. */
export function mustHandOff(memberText: string, topic: Topic): string | null {
  for (const [re, why] of ALWAYS_HUMAN) if (re.test(memberText)) return why;
  return HUMAN_TOPICS[topic] ?? null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/support/guard.test.ts && npx tsc --noEmit`
Expected: 12 tests PASS, and tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/support/guard.ts src/lib/support/guard.test.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): draft guard (amounts, IB, bonus, links, handles, profit, deposit claims)"
```

---

### Task 6: Member matching (`member.ts`)

A chat is matched to a member by the deposit **reference code** (`MM-` plus the first 6 hex characters of the user id, from `src/lib/depositRef.ts`) or by an exact **Telegram handle** on a deposit submission. Only an exact single match counts. A uuid column can't be prefix-matched safely through PostgREST, so a small service-role-only SQL function does the reference lookup.

**Files:**
- Create: `supabase/migrations/20260915000011_support_member_lookup.sql`, `scripts/apply-support-member-lookup.mjs`, `src/lib/support/member.ts`, `src/lib/support/member.test.ts`

- [ ] **Step 1: Write the lookup function**

`supabase/migrations/20260915000011_support_member_lookup.sql`:
```sql
-- Support agent: resolve a deposit reference code (MM-XXXXXX = first 6 hex chars
-- of profiles.id) to a user id. Returns NULL unless exactly one profile matches.
-- Service role only: the agent route calls it; members and anon can't.
create or replace function public.fn_support_member_by_ref(p_hex text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then min(id::text)::uuid end
    from public.profiles
   where p_hex ~ '^[0-9a-fA-F]{6}$'
     and replace(id::text, '-', '') like lower(p_hex) || '%';
$$;

revoke all on function public.fn_support_member_by_ref(text) from public, anon, authenticated;
grant execute on function public.fn_support_member_by_ref(text) to service_role;
```

`scripts/apply-support-member-lookup.mjs`:
```js
// One-off: apply 20260915000011_support_member_lookup.sql, then prove it resolves
// a real member's reference and refuses bad input.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000011_support_member_lookup.sql", import.meta.url), "utf8");
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});
let failed = false;
const ok = (l, c, d = "") => { if (!c) failed = true; console.log(`${c ? "ok  " : "FAIL"}  ${l}${d ? "  " + d : ""}`); };
try {
  await client.connect();
  await client.query(SQL);
  const u = (await client.query("select id from public.profiles order by signup_at desc limit 1")).rows[0].id;
  const hex = u.replace(/-/g, "").slice(0, 6).toUpperCase();
  const got = (await client.query("select public.fn_support_member_by_ref($1) id", [hex])).rows[0].id;
  ok("resolves a real reference", got === u, `MM-${hex}`);
  const bad = (await client.query("select public.fn_support_member_by_ref($1) id", ["zz'--"])).rows[0].id;
  ok("refuses non-hex input", bad === null);
  const grants = (await client.query(
    `select coalesce(array_agg(grantee::text order by grantee::text), '{}') g from information_schema.routine_privileges
      where routine_schema='public' and routine_name='fn_support_member_by_ref' and privilege_type='EXECUTE'`)).rows[0].g;
  ok("only service_role (and owner) can execute", !grants.includes("anon") && !grants.includes("authenticated"), JSON.stringify(grants));
} catch (e) { failed = true; console.error(e); }
finally { await client.end(); process.exit(failed ? 1 : 0); }
```

- [ ] **Step 2: Apply and verify**

Run: `node scripts/apply-support-member-lookup.mjs`
Expected: three `ok` lines, exit 0.

- [ ] **Step 3: Write the failing test**

`src/lib/support/member.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { refFromTexts, findMember } from "./member";

describe("refFromTexts", () => {
  it("finds the latest reference code, case-insensitively", () => {
    expect(refFromTexts(["hi", "Hi Amelia, I'm submitting my deposit on the MMFX app. My reference is MM-3f9a2c."])).toBe("3F9A2C");
    expect(refFromTexts(["MM-111111", "actually MM-AAAAAA"])).toBe("AAAAAA");
    expect(refFromTexts(["no code here", "MM-12345"])).toBeNull();
  });
});

// Minimal fake of the supabase-js calls findMember makes.
function fakeDb(opts: {
  refUser?: string | null;
  handleRows?: { user_id: string }[];
  profile?: Record<string, unknown> | null;
  submission?: Record<string, unknown> | null;
}) {
  return {
    rpc: async () => ({ data: opts.refUser ?? null, error: null }),
    from(table: string) {
      const q: any = {
        select: () => q, eq: () => q, ilike: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => ({ data: table === "profiles" ? opts.profile ?? null : opts.submission ?? null, error: null }),
        then: (res: (v: unknown) => void) => res({ data: opts.handleRows ?? [], error: null }),
      };
      return q;
    },
  } as never;
}
const profile = { account_status: "member_active", trial_ends_at: null, deposit_amount: 250, grandfathered: false, lifetime_plan: null };

describe("findMember", () => {
  it("matches by reference code first", async () => {
    const db = fakeDb({ refUser: "u1", profile, submission: { status: "pending", reject_reason: null, created_at: "2026-09-15T01:00:00Z" } });
    const m = await findMember(db, { texts: ["My reference is MM-ABCDEF"], telegramUsername: null });
    expect(m).toMatchObject({ userId: "u1", matchedBy: "ref", tier: "desk", submission: { status: "pending" } });
  });
  it("falls back to an exact single Telegram-handle match", async () => {
    const db = fakeDb({ handleRows: [{ user_id: "u2" }, { user_id: "u2" }], profile, submission: null });
    const m = await findMember(db, { texts: ["hello"], telegramUsername: "Sam_T" });
    expect(m).toMatchObject({ userId: "u2", matchedBy: "handle", submission: null });
  });
  it("refuses an ambiguous handle", async () => {
    const db = fakeDb({ handleRows: [{ user_id: "u2" }, { user_id: "u3" }], profile });
    await expect(findMember(db, { texts: [], telegramUsername: "Sam_T" })).resolves.toBeNull();
  });
  it("returns null with neither a code nor a handle", async () => {
    await expect(findMember(fakeDb({}), { texts: ["hi"], telegramUsername: null })).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/member.test.ts`
Expected: FAIL, `Cannot find module './member'`.

- [ ] **Step 5: Implement member matching**

`src/lib/support/member.ts`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accessTierFor, type TierSnapshot } from "@/lib/tiers";
import type { MemberContext } from "./types";

const REF_RE = /\bMM-([0-9a-f]{6})\b/gi;

/** The hex of the most recent MM-XXXXXX reference in the texts, uppercased. */
export function refFromTexts(texts: string[]): string | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const all = [...texts[i].matchAll(REF_RE)];
    if (all.length) return all[all.length - 1][1].toUpperCase();
  }
  return null;
}

async function userByRef(db: SupabaseClient, hex: string): Promise<string | null> {
  const { data } = await db.rpc("fn_support_member_by_ref", { p_hex: hex });
  return typeof data === "string" ? data : null;
}

async function userByHandle(db: SupabaseClient, handle: string): Promise<string | null> {
  const { data } = await db.from("deposit_submissions").select("user_id").ilike("telegram_username", handle.replace(/^@/, ""));
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  return ids.length === 1 ? ids[0] : null;
}

export async function findMember(
  db: SupabaseClient,
  opts: { texts: string[]; telegramUsername: string | null }
): Promise<MemberContext | null> {
  let userId: string | null = null;
  let matchedBy: MemberContext["matchedBy"] = "ref";
  const hex = refFromTexts(opts.texts);
  if (hex) userId = await userByRef(db, hex);
  if (!userId && opts.telegramUsername) { userId = await userByHandle(db, opts.telegramUsername); matchedBy = "handle"; }
  if (!userId) return null;

  const { data: p } = await db.from("profiles")
    .select("account_status, trial_ends_at, deposit_amount, grandfathered, lifetime_plan")
    .eq("id", userId).maybeSingle();
  if (!p) return null;
  const { data: s } = await db.from("deposit_submissions")
    .select("status, reject_reason, created_at").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  return {
    userId,
    matchedBy,
    tier: accessTierFor(p as TierSnapshot),
    trialEndsAt: (p as TierSnapshot).trial_ends_at ? String((p as TierSnapshot).trial_ends_at) : null,
    submission: s ? { status: s.status, rejectReason: s.reject_reason ?? null, createdAt: s.created_at } : null,
  };
}
```

`.ilike()` with no wildcard is a case-insensitive exact match, which is what we want for handles.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/support/member.test.ts && npx tsc --noEmit`
Expected: 5 tests PASS, and tsc exits 0.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260915000011_support_member_lookup.sql scripts/apply-support-member-lookup.mjs src/lib/support/member.ts src/lib/support/member.test.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): match a chat to a member by reference code or Telegram handle"
```

---

### Task 7: The Claude call (`agent.ts`)

Per the Claude API reference, this uses the official SDK with:
- structured output: `output_config.format` with `zodOutputFormat`
- `claude-opus-5` at effort `medium` (adaptive thinking is on by default for Opus 5)
- refusal fallbacks: `fallbacks: "default"`, behind the `server-side-fallback-2026-07-01` beta header
- the system prompt cached (`cache_control`), since the facts are stable between messages

**Files:**
- Create: `src/lib/support/agent.ts`, `src/lib/support/agent.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/support/agent.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { decide, buildSystem, buildUserContent } from "./agent";
import type { FactSheet, ThreadMessage } from "./types";

const facts = { text: "PLANS: Foundation from $50.", allow: {} } as unknown as FactSheet;
const thread: ThreadMessage[] = [
  { id: "1", direction: "in", fromFlow: false, text: "How much to join?", at: "2026-09-15T01:00:00Z" },
  { id: "2", direction: "out", fromFlow: true, text: "Where are you based?", at: "2026-09-15T01:00:01Z" },
  { id: "3", direction: "in", fromFlow: false, text: "Malaysia. So what's the minimum?", at: "2026-09-15T01:00:30Z" },
];
const contact = { id: "c1", username: "sam", firstName: "Sam", isBusiness: false, tags: ["country_malaysia"] };

function client(response: unknown) {
  const create = vi.fn(async () => response);
  return { c: { beta: { messages: { create } } } as never, create };
}
const ok = (decision: unknown) => ({
  stop_reason: "end_turn", model: "claude-opus-5",
  content: [{ type: "text", text: JSON.stringify(decision) }],
});

describe("decide", () => {
  const good = { action: "reply", topic: "plans", confidence: 0.9, reply: "Foundation starts at $50.", reason: "fact sheet" };

  it("returns a validated decision and sends the right request", async () => {
    const { c, create } = client(ok(good));
    const out = await decide({ facts, thread, contact, member: null }, c);
    expect(out.decision).toEqual(good);
    const req = (create.mock.calls[0] as unknown[])[0] as Record<string, any>;
    expect(req.model).toBe("claude-opus-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(req.output_config.effort).toBe("medium");
    expect(req.system[0].text).toContain("PLANS: Foundation from $50.");
  });

  it("treats a refusal as no decision", async () => {
    const { c } = client({ stop_reason: "refusal", model: "claude-opus-5", content: [] });
    await expect(decide({ facts, thread, contact, member: null }, c)).resolves.toMatchObject({ decision: null, refused: true });
  });

  it("returns no decision for output that doesn't match the schema", async () => {
    const { c } = client(ok({ action: "maybe" }));
    await expect(decide({ facts, thread, contact, member: null }, c)).resolves.toMatchObject({ decision: null, refused: false });
  });

  it("returns no decision when the API call throws", async () => {
    const c = { beta: { messages: { create: vi.fn(async () => { throw new Error("timeout"); }) } } } as never;
    await expect(decide({ facts, thread, contact, member: null }, c)).resolves.toMatchObject({ decision: null });
  });
});

describe("prompt building", () => {
  it("labels flow messages so the model knows the bot asked them", () => {
    expect(buildUserContent({ thread, contact, member: null })).toContain("[bot flow] Where are you based?");
  });
  it("only includes member status when a member is matched", () => {
    expect(buildUserContent({ thread, contact, member: null })).toContain("MEMBER: not identified");
    const withMember = buildUserContent({ thread, contact, member: {
      userId: "u", matchedBy: "ref", tier: "desk", trialEndsAt: null,
      submission: { status: "pending", rejectReason: null, createdAt: "2026-09-15" } } });
    expect(withMember).toContain("tier: Desk");
    expect(withMember).toContain("latest deposit submission: pending");
  });
  it("passes redraft reasons back to the model", () => {
    expect(buildUserContent({ thread, contact, member: null, retryReasons: ["link not allowed: https://forms.gle/x"] }))
      .toContain("link not allowed");
  });
  it("redacts emails, phone numbers and account numbers before they reach the model", () => {
    const t = [{ id: "9", direction: "in" as const, fromFlow: false, at: "2026-09-15T01:00:00Z",
      text: "me@x.com, +65 9123 4567, account 2167136, balance $198, ref MM-3F9A2C" }];
    const out = buildUserContent({ thread: t, contact, member: null });
    expect(out).not.toMatch(/me@x\.com|9123 4567|2167136/);
    expect(out).toContain("$198");
    expect(out).toContain("MM-3F9A2C");
  });
  it("puts the rules and facts in the system prompt", () => {
    const s = buildSystem(facts);
    expect(s).toContain("Use ONLY the facts");
    expect(s).toContain("PLANS: Foundation from $50.");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/agent.test.ts`
Expected: FAIL, `Cannot find module './agent'`.

- [ ] **Step 3: Implement the agent call**

`src/lib/support/agent.ts`:
```ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tierLabel } from "@/lib/tiers";
import { TOPICS, type ContactInfo, type Decision, type FactSheet, type MemberContext, type ThreadMessage } from "./types";

export const DecisionSchema = z.object({
  action: z.enum(["reply", "handoff"]),
  topic: z.enum(TOPICS),
  confidence: z.number().min(0).max(1),
  reply: z.string(),
  reason: z.string(),
});

export const MODEL = process.env.SUPPORT_AGENT_MODEL || "claude-opus-5";

const RULES = `You are the MMFX Assistant. You reply on Telegram to people contacting Market Makers FX (MMFX), a forex and gold trading education community.

How to write:
- Reply in the member's language. Keep it short (usually under 500 characters), warm and plain. No headings, no markdown. Write links as plain URLs.
- Never say you are Admin Amelia or a person. Don't sign off with a name.

What you may say:
- Use ONLY the facts in the FACTS block. Never state a price, amount, IB number, bonus code, link or @handle that isn't in the FACTS. If the facts don't cover the question, choose handoff.
- Never promise or suggest profits, returns or income. Trading involves risk.
- When explaining how to join, give the steps in the order in the FACTS, and never tell anyone to message Admin Amelia before they've topped up.
- Talk about a member's own tier or deposit only when a MEMBER block is present. Never say a deposit is received, approved or verified unless the MEMBER block says the latest submission is verified.
- If the member sent a reference code (MM- plus 6 characters), acknowledge it: note the code, tell them to submit the deposit details on the upgrade page if their top-up is already in (or to top up first if not), and say the team checks it and emails them when it's approved.
- If someone wants to join or sign up, point them to the upgrade page, or to an approved flow link where the FACTS say to.

When to hand off (action "handoff", reply ""):
- withdrawals, missing or pending funds, refunds, payments already made, disputes, complaints, abuse, legal threats, account deletion
- anything the FACTS don't cover, or anything you're not sure of (confidence below 0.7)
- when they ask for a human

Output: the JSON decision. "reply" is the exact message to send. "topic" is the closest listed topic. "reason" is one short line for the log.`;

export function buildSystem(facts: FactSheet): string {
  return `${RULES}\n\nFACTS\n${facts.text}`;
}

/** Strip emails, phone numbers and account-style numbers before text reaches the model (spec: privacy). */
export function redactForModel(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[number]")
    .replace(/\b\d{6,12}\b/g, "[number]");
}

export function buildUserContent(args: {
  thread: ThreadMessage[];
  contact: ContactInfo;
  member: MemberContext | null;
  retryReasons?: string[];
}): string {
  const { thread, contact, member, retryReasons } = args;
  const lines = thread.map((m) =>
    `${m.direction === "in" ? "[member]" : m.fromFlow ? "[bot flow]" : "[MMFX]"} ${redactForModel(m.text) || "(no text: media or button)"}`);
  const memberLine = member
    ? `MEMBER: identified by ${member.matchedBy === "ref" ? "reference code" : "Telegram username"}; tier: ${tierLabel(member.tier)}; trial ends: ${member.trialEndsAt ?? "n/a"}; latest deposit submission: ${member.submission ? member.submission.status + (member.submission.rejectReason ? ` (reason: ${member.submission.rejectReason})` : "") : "none"}`
    : "MEMBER: not identified. Don't state any member-specific status.";
  return [
    `CHAT: ${contact.isBusiness ? "sent to Admin Amelia's account (@MM_3000)" : "chat with the MMFX bot"}. First name: ${contact.firstName || "unknown"}. Tags: ${contact.tags.join(", ") || "none"}.`,
    memberLine,
    "THREAD (oldest first; answer the member's latest message):",
    ...lines,
    ...(retryReasons?.length ? ["", `Your previous draft was rejected: ${retryReasons.join("; ")}. Write a new reply that fixes this, or hand off.`] : []),
  ].join("\n");
}

export async function decide(
  args: { facts: FactSheet; thread: ThreadMessage[]; contact: ContactInfo; member: MemberContext | null; retryReasons?: string[] },
  client: Anthropic = new Anthropic({ timeout: 35_000, maxRetries: 1 })
): Promise<{ decision: Decision | null; refused: boolean; model: string; error?: string }> {
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(DecisionSchema) },
      system: [{ type: "text", text: buildSystem(args.facts), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserContent(args) }],
    });
    if (res.stop_reason === "refusal") return { decision: null, refused: true, model: res.model };
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const parsed = DecisionSchema.safeParse(JSON.parse(text));
    return { decision: parsed.success ? parsed.data : null, refused: false, model: res.model };
  } catch (e) {
    return { decision: null, refused: false, model: MODEL, error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run src/lib/support/agent.test.ts && npx tsc --noEmit`
Expected: 9 tests PASS, and tsc exits 0.

**If tsc rejects `fallbacks: "default"` or `output_config.format` on `client.beta.messages.create`** (the installed SDK types may lag the API), switch to the documented `client.messages.parse` and drop the beta fields:
```ts
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(DecisionSchema) },
      system: [{ type: "text", text: buildSystem(args.facts), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserContent(args) }],
    });
    if (res.stop_reason === "refusal") return { decision: null, refused: true, model: res.model };
    return { decision: res.parsed_output ?? null, refused: false, model: res.model };
```
In the tests, change the fake to `{ messages: { parse } }` returning `{ stop_reason, model, parsed_output }`, and drop the `fallbacks`/`betas` assertions. Refusals then hand off, which is safe. Note the switch in the PR description.

- [ ] **Step 5: Commit**

```bash
git add src/lib/support/agent.ts src/lib/support/agent.test.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): Claude decision call (structured output, Opus 5, refusal fallbacks)"
```

---

### Task 8: The orchestrator (`store.ts` + `run.ts`)

`run.ts` holds every decision rule. It talks to the database only through a small `SupportStore` interface, so tests use an in-memory store.

**Files:**
- Create: `src/lib/support/store.ts`, `src/lib/support/run.ts`, `src/lib/support/run.test.ts`
- Modify: `src/lib/telegram.ts` (add an optional `chatId`, so handoff pings can go to Amelia)

- [ ] **Step 1: Let `sendTelegram` target another chat**

In `src/lib/telegram.ts`, add to `SendTelegramOptions`:
```ts
  /** Send to this chat instead of TELEGRAM_CHAT_ID (e.g. the support ping chat). */
  chatId?: string;
```
and change
```ts
  const chatId = process.env.TELEGRAM_CHAT_ID;
```
to
```ts
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID;
```
Nothing else changes, and existing callers keep their behaviour.

- [ ] **Step 2: Create the store**

`src/lib/support/store.ts`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/channel/db";
import type { SupportSettings } from "./types";

export interface ChatRow {
  contact_id: string;
  is_business?: boolean;
  telegram_username?: string | null;
  matched_user_id?: string | null;
  state: "auto" | "quiet" | "needs_amelia";
  quiet_until?: string | null;
  handoff_reason?: string | null;
  last_member_msg_at?: string | null;
  last_agent_reply_at?: string | null;
}

export interface EventRow {
  contact_id: string;
  kind: "incoming" | "reply" | "handoff" | "skip" | "error" | "amelia_reply";
  dedupe_key?: string;
  member_text?: string;
  topic?: string;
  confidence?: number;
  reply_text?: string;
  skip_reason?: string;
  guard_failures?: string[];
  model?: string;
  latency_ms?: number;
}

export interface SupportStore {
  getSettings(): Promise<SupportSettings | null>;
  getChat(contactId: string): Promise<ChatRow | null>;
  saveChat(patch: Partial<ChatRow> & { contact_id: string }): Promise<void>;
  countRepliesSince(contactId: string, sinceIso: string): Promise<number>;
  countModelCallsSince(sinceIso: string): Promise<number>;
  /** Texts the agent itself sent to this chat recently (replies and holding lines). */
  recentAgentTexts(contactId: string, sinceIso: string): Promise<string[]>;
  /** Insert an event. Returns false on a duplicate dedupe_key. */
  log(ev: EventRow): Promise<boolean>;
}

export function supabaseStore(db: SupabaseClient = adminDb()): SupportStore {
  return {
    async getSettings() {
      const { data } = await db.from("support_settings").select("*").eq("id", 1).maybeSingle();
      return (data as SupportSettings | null) ?? null;
    },
    async getChat(contactId) {
      const { data } = await db.from("support_chats").select("*").eq("contact_id", contactId).maybeSingle();
      return (data as ChatRow | null) ?? null;
    },
    async saveChat(patch) {
      await db.from("support_chats").upsert({ ...patch, updated_at: new Date().toISOString() }, { onConflict: "contact_id" });
    },
    async countRepliesSince(contactId, sinceIso) {
      const { count } = await db.from("support_events").select("id", { count: "exact", head: true })
        .eq("contact_id", contactId).eq("kind", "reply").gte("created_at", sinceIso);
      return count ?? 0;
    },
    async countModelCallsSince(sinceIso) {
      const { count } = await db.from("support_events").select("id", { count: "exact", head: true })
        .not("model", "is", null).gte("created_at", sinceIso);
      return count ?? 0;
    },
    async recentAgentTexts(contactId, sinceIso) {
      const { data } = await db.from("support_events").select("reply_text")
        .eq("contact_id", contactId).in("kind", ["reply", "handoff"]).gte("created_at", sinceIso);
      return ((data ?? []) as { reply_text: string | null }[]).map((r) => r.reply_text).filter((t): t is string => Boolean(t));
    },
    async log(ev) {
      const { error } = await db.from("support_events").insert(ev);
      return !error || error.code !== "23505" ? !error : false;
    },
  };
}
```

- [ ] **Step 3: Write the failing test**

`src/lib/support/run.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { runBurst, handleOutgoing, PREFIX, type RunDeps } from "./run";
import type { ChatRow, EventRow } from "./store";
import type { ContactInfo, Decision, SupportSettings, ThreadMessage } from "./types";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }],
  office_hours: "during Singapore office hours", trade_cadence: "x", notes: "", approved_flows: [],
};
const NOW = new Date("2026-09-15T04:00:30Z");
const T0 = "2026-09-15T04:00:00Z";
const msg = (id: string, direction: "in" | "out", text: string, at = T0, fromFlow = false): ThreadMessage =>
  ({ id, direction, text, at, fromFlow });
const reply = (text: string, extra: Partial<Decision> = {}): Decision =>
  ({ action: "reply", topic: "plans", confidence: 0.9, reply: text, reason: "facts", ...extra });

function setup(opts: {
  thread: ThreadMessage[];
  contact?: Partial<ContactInfo>;
  decisions?: (Decision | null)[];
  chat?: ChatRow | null;
  settings?: SupportSettings | null;
}) {
  const events: EventRow[] = [];
  let chat: ChatRow | null = opts.chat ?? null;
  const decisions = [...(opts.decisions ?? [])];
  const sp = {
    getMessages: vi.fn(async () => opts.thread),
    getContact: vi.fn(async () => ({ id: "c1", username: "sam", firstName: "Sam", isBusiness: false, tags: [], ...opts.contact })),
    send: vi.fn(async () => true),
    setTag: vi.fn(async () => true),
    setPauseAutomation: vi.fn(async () => true),
    openChat: vi.fn(async () => true),
  };
  const decide = vi.fn(async () => {
    const d = decisions.shift() ?? null;
    return { decision: d, refused: false, model: "claude-opus-5" };
  });
  const deps: RunDeps = {
    store: {
      getSettings: async () => (opts.settings === undefined ? settings : opts.settings),
      getChat: async () => chat,
      saveChat: async (p) => { chat = { ...(chat ?? { contact_id: p.contact_id, state: "auto" }), ...p }; },
      countRepliesSince: async () => events.filter((e) => e.kind === "reply").length,
      countModelCallsSince: async () => 0,
      recentAgentTexts: async () => events.map((e) => e.reply_text).filter((t): t is string => Boolean(t)),
      log: async (e) => { events.push(e); return true; },
    },
    sp, decide: decide as never,
    findMember: vi.fn(async () => null),
    ping: vi.fn(async () => ({})),
    sleep: vi.fn(async () => {}),
    now: () => NOW,
  };
  return { deps, sp, decide, events, get chat() { return chat; } };
}

describe("runBurst", () => {
  it("replies with the drafted text and logs it", async () => {
    const s = setup({ thread: [msg("1", "in", "How much to join?")], decisions: [reply("Foundation starts at $50: https://app.marketmakersfx.net/upgrade")] });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "reply" });
    expect(s.sp.send).toHaveBeenCalledWith("c1", "Foundation starts at $50: https://app.marketmakersfx.net/upgrade");
    expect(s.events.at(-1)).toMatchObject({ kind: "reply", topic: "plans" });
  });

  it("prefixes replies in Amelia's-account chats", async () => {
    const s = setup({ thread: [msg("1", "in", "trial length?")], contact: { isBusiness: true }, decisions: [reply("The trial is 14 days.", { topic: "trial" })] });
    await runBurst("c1", T0, s.deps);
    expect(s.sp.send).toHaveBeenCalledWith("c1", `${PREFIX}The trial is 14 days.`);
  });

  it("stays out when a SendPulse flow already answered", async () => {
    const s = setup({ thread: [msg("1", "in", "Malaysia"), msg("2", "out", "Last one — where are you based?", "2026-09-15T04:00:02Z", true)] });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "skip", reason: "flow answered" });
    expect(s.decide).not.toHaveBeenCalled();
    expect(s.sp.send).not.toHaveBeenCalled();
  });

  it("leaves a burst to the newest message's own run", async () => {
    const s = setup({ thread: [msg("1", "in", "Hi", T0), msg("2", "in", "Sir?", "2026-09-15T04:00:10Z")] });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "skip", reason: "newer message" });
  });

  it("hands money questions to Amelia without calling Claude", async () => {
    const s = setup({ thread: [msg("1", "in", "How do I withdraw my money?")] });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "handoff", reason: "withdrawal" });
    expect(s.decide).not.toHaveBeenCalled();
    expect(s.sp.send).toHaveBeenCalledWith("c1", expect.stringContaining("passed this to Admin Amelia"));
    expect(s.sp.setTag).toHaveBeenCalledWith("c1", "needs-amelia");
    expect(s.sp.setPauseAutomation).toHaveBeenCalledWith("c1", 1440);
    expect(s.sp.openChat).toHaveBeenCalledWith("c1");
    expect(s.chat?.state).toBe("needs_amelia");
    expect(s.deps.ping).toHaveBeenCalled();
  });

  it("redrafts once after a guard failure, then sends the fixed reply", async () => {
    const s = setup({ thread: [msg("1", "in", "min deposit?")], decisions: [reply("The minimum is USD100."), reply("Foundation starts at $50.")] });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "reply" });
    expect(s.decide).toHaveBeenCalledTimes(2);
    expect(((s.decide.mock.calls[1] as unknown[])[0] as { retryReasons: string[] }).retryReasons[0]).toContain("amount");
    expect(s.sp.send).toHaveBeenCalledWith("c1", "Foundation starts at $50.");
  });

  it("hands off when the redraft still fails the guard", async () => {
    const s = setup({ thread: [msg("1", "in", "min deposit?")], decisions: [reply("USD100."), reply("Still USD100.")] });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "handoff" });
    expect(s.events.at(-1)?.guard_failures?.[0]).toContain("amount");
  });

  it("on a model error, sends the member nothing and flags the chat", async () => {
    const s = setup({ thread: [msg("1", "in", "question?")], decisions: [null] });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "handoff" });
    expect(s.sp.send).not.toHaveBeenCalled();
    expect(s.sp.setTag).toHaveBeenCalledWith("c1", "needs-amelia");
  });

  it("does nothing while switched off", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], settings: { ...settings, enabled: false } });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "skip", reason: "switched off" });
    expect(s.sp.getMessages).not.toHaveBeenCalled();
  });

  it("leaves Needs-Amelia chats alone", async () => {
    const s = setup({ thread: [msg("1", "in", "hi")], chat: { contact_id: "c1", state: "needs_amelia" } });
    await expect(runBurst("c1", T0, s.deps)).resolves.toMatchObject({ kind: "skip", reason: "needs_amelia" });
  });
});

describe("handleOutgoing", () => {
  it("goes quiet for an hour when a person replies", async () => {
    const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "Hi, Amelia here!", "2026-09-15T04:00:20Z")] });
    await expect(handleOutgoing("c1", s.deps)).resolves.toBe("amelia_reply");
    expect(s.chat?.state).toBe("quiet");
    expect(s.chat?.quiet_until).toBe("2026-09-15T05:00:30.000Z");
  });
  it("ignores its own echoes and flow messages", async () => {
    const s = setup({ thread: [msg("1", "in", "hi"), msg("2", "out", "Where are you based?", T0, true)] });
    await expect(handleOutgoing("c1", s.deps)).resolves.toBe("ignored");
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/run.test.ts`
Expected: FAIL, `Cannot find module './run'`.

- [ ] **Step 5: Implement the orchestrator**

`src/lib/support/run.ts`:
```ts
import "server-only";
import { adminDb } from "@/lib/channel/db";
import { sendTelegram, escapeHtml } from "@/lib/telegram";
import * as sendpulse from "./sendpulse";
import { decide as realDecide } from "./agent";
import { buildFactSheet } from "./facts";
import { checkDraft, mustHandOff } from "./guard";
import { findMember as realFindMember } from "./member";
import { supabaseStore, type SupportStore } from "./store";
import type { ContactInfo, MemberContext, SupportSettings, ThreadMessage } from "./types";

export const WAIT_MS = 20_000;
export const CONFIDENCE_MIN = 0.7;
export const MAX_REPLIES_PER_HOUR = 6;
export const MAX_CALLS_PER_DAY = 1500;
export const QUIET_MINUTES = 60;
export const HANDOFF_PAUSE_MINUTES = 1440;
export const PREFIX = "MMFX Assistant: ";
const TAG = "needs-amelia";

export interface RunDeps {
  store: SupportStore;
  sp: Pick<typeof sendpulse, "getMessages" | "getContact" | "send" | "setTag" | "setPauseAutomation" | "openChat">;
  decide: typeof realDecide;
  findMember: (opts: { texts: string[]; telegramUsername: string | null }) => Promise<MemberContext | null>;
  ping: (html: string) => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
}

export function defaultDeps(): RunDeps {
  const db = adminDb();
  return {
    store: supabaseStore(db),
    sp: sendpulse,
    decide: realDecide,
    findMember: (o) => realFindMember(db, o),
    ping: (html) => sendTelegram(html, { chatId: process.env.SUPPORT_PING_CHAT_ID }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => new Date(),
  };
}

export type RunOutcome = { kind: "reply" | "handoff" | "skip" | "error"; reason?: string };

const minus = (d: Date, ms: number) => new Date(d.getTime() - ms).toISOString();
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms).toISOString();
/** Midnight Singapore time (UTC+8) for the SGT day containing `d`. */
function sgtDayStart(d: Date): string {
  const sgt = new Date(d.getTime() + 8 * 3600_000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()) - 8 * 3600_000).toISOString();
}

export async function runBurst(contactId: string, triggerAt: string, deps: RunDeps = defaultDeps()): Promise<RunOutcome> {
  const { store, sp } = deps;
  const skip = async (reason: string): Promise<RunOutcome> => {
    await store.log({ contact_id: contactId, kind: "skip", skip_reason: reason });
    return { kind: "skip", reason };
  };

  try {
    const settings = await store.getSettings();
    if (!settings) return skip("no settings");
    if (!settings.enabled || process.env.SUPPORT_AGENT_ENABLED === "false") return skip("switched off");

    const chat = await store.getChat(contactId);
    if (chat?.state === "needs_amelia") return skip("needs_amelia");
    if (chat?.state === "quiet" && chat.quiet_until && Date.parse(chat.quiet_until) > deps.now().getTime()) return skip("quiet");

    await deps.sleep(WAIT_MS);

    const thread = await sp.getMessages(contactId, 15);
    const lastIn = thread.map((m) => m.direction).lastIndexOf("in");
    if (lastIn === -1) return skip("no member message");
    if (Date.parse(thread[lastIn].at) > Date.parse(triggerAt) + 1000) return skip("newer message");
    const after = thread.slice(lastIn + 1);
    if (after.some((m) => m.fromFlow)) return skip("flow answered");
    const ours = await store.recentAgentTexts(contactId, minus(deps.now(), 30 * 60_000));
    if (after.some((m) => m.direction === "out" && !ours.includes(m.text))) {
      await store.saveChat({ contact_id: contactId, state: "quiet", quiet_until: plus(deps.now(), QUIET_MINUTES * 60_000) });
      return skip("answered by a person");
    }

    let start = lastIn;
    while (start > 0 && thread[start - 1].direction === "in") start--;
    const memberText = thread.slice(start, lastIn + 1).map((m) => m.text).filter(Boolean).join("\n");
    const memberTexts = thread.filter((m) => m.direction === "in").map((m) => m.text);

    const contact: ContactInfo = (await sp.getContact(contactId))
      ?? { id: contactId, username: null, firstName: "", isBusiness: false, tags: [] };
    const member = await deps.findMember({ texts: memberTexts, telegramUsername: contact.username });
    await store.saveChat({
      contact_id: contactId, state: "auto", is_business: contact.isBusiness,
      telegram_username: contact.username, matched_user_id: member?.userId ?? null,
      last_member_msg_at: thread[lastIn].at,
    });

    const ctx = { deps, settings, contact, contactId, memberText };
    if (await store.countRepliesSince(contactId, minus(deps.now(), 3600_000)) >= MAX_REPLIES_PER_HOUR) return handoff(ctx, "reply cap reached");
    if (await store.countModelCallsSince(sgtDayStart(deps.now())) >= MAX_CALLS_PER_DAY) return handoff(ctx, "daily cap reached");

    const hard = mustHandOff(memberText, "other");
    if (hard) return handoff(ctx, hard);

    const facts = buildFactSheet(settings, deps.now());
    const started = Date.now();
    const first = await deps.decide({ facts, thread, contact, member });
    if (!first.decision) {
      return handoff(ctx, first.refused ? "model refused" : `model error${first.error ? `: ${first.error}` : ""}`, { sendHolding: false, model: first.model });
    }
    let d = first.decision;
    if (d.action === "handoff" || d.confidence < CONFIDENCE_MIN) return handoff(ctx, d.reason || "model chose handoff", { model: first.model, topic: d.topic });
    const topicHard = mustHandOff(memberText, d.topic);
    if (topicHard) return handoff(ctx, topicHard, { model: first.model, topic: d.topic });

    const guardCtx = { facts, memberTexts, member };
    const fails = checkDraft(d.reply, guardCtx);
    if (fails.length) {
      const second = await deps.decide({ facts, thread, contact, member, retryReasons: fails });
      const s = second.decision;
      if (!s || s.action !== "reply" || s.confidence < CONFIDENCE_MIN || checkDraft(s.reply, guardCtx).length) {
        return handoff(ctx, `guard: ${fails.join("; ")}`, { guardFailures: fails, model: first.model, topic: d.topic });
      }
      d = s;
    }

    const text = contact.isBusiness ? PREFIX + d.reply : d.reply;
    let sent = await sp.send(contactId, text);
    if (!sent) { await deps.sleep(2000); sent = await sp.send(contactId, text); }
    if (!sent) return handoff(ctx, "send failed", { sendHolding: false, model: first.model, topic: d.topic });

    await store.log({
      contact_id: contactId, kind: "reply", member_text: memberText, topic: d.topic, confidence: d.confidence,
      reply_text: text, model: first.model, latency_ms: Date.now() - started,
    });
    await store.saveChat({ contact_id: contactId, state: "auto", last_agent_reply_at: deps.now().toISOString() });
    return { kind: "reply" };
  } catch (e) {
    await store.log({ contact_id: contactId, kind: "error", skip_reason: e instanceof Error ? e.message : String(e) }).catch(() => false);
    return { kind: "error", reason: e instanceof Error ? e.message : String(e) };
  }
}

async function handoff(
  ctx: { deps: RunDeps; settings: SupportSettings; contact: ContactInfo; contactId: string; memberText: string },
  reason: string,
  opts: { sendHolding?: boolean; guardFailures?: string[]; model?: string; topic?: string } = {}
): Promise<RunOutcome> {
  const { deps, settings, contact, contactId, memberText } = ctx;
  const holding = `${contact.isBusiness ? PREFIX : ""}Thanks, I've passed this to Admin Amelia. She'll reply here ${settings.office_hours}.`;
  if (opts.sendHolding !== false) await deps.sp.send(contactId, holding);
  await deps.sp.setTag(contactId, TAG);
  await deps.sp.setPauseAutomation(contactId, HANDOFF_PAUSE_MINUTES);
  await deps.sp.openChat(contactId);
  await deps.store.saveChat({ contact_id: contactId, state: "needs_amelia", handoff_reason: reason });
  await deps.ping(
    `🙋 <b>Needs Amelia</b> · ${escapeHtml(contact.firstName || "Member")}${contact.username ? ` (@${escapeHtml(contact.username)})` : ""}` +
    `\n“${escapeHtml(memberText.slice(0, 300))}”\n<i>Reason: ${escapeHtml(reason)}</i>`
  );
  await deps.store.log({
    contact_id: contactId, kind: "handoff", member_text: memberText, topic: opts.topic, skip_reason: reason,
    reply_text: opts.sendHolding !== false ? holding : undefined, guard_failures: opts.guardFailures, model: opts.model,
  });
  return { kind: "handoff", reason };
}

/** An outgoing message the agent didn't send: a person replied, so go quiet. */
export async function handleOutgoing(contactId: string, deps: RunDeps = defaultDeps()): Promise<"amelia_reply" | "ignored"> {
  const thread: ThreadMessage[] = await deps.sp.getMessages(contactId, 5);
  const lastOut = [...thread].reverse().find((m) => m.direction === "out");
  if (!lastOut || lastOut.fromFlow) return "ignored";
  const ours = await deps.store.recentAgentTexts(contactId, minus(deps.now(), 30 * 60_000));
  if (ours.includes(lastOut.text)) return "ignored";
  const chat = await deps.store.getChat(contactId);
  if (chat?.state !== "needs_amelia") {
    await deps.store.saveChat({ contact_id: contactId, state: "quiet", quiet_until: plus(deps.now(), QUIET_MINUTES * 60_000) });
  }
  await deps.store.log({ contact_id: contactId, kind: "amelia_reply", reply_text: lastOut.text });
  return "amelia_reply";
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/support/run.test.ts && npx tsc --noEmit`
Expected: 12 tests PASS, and tsc exits 0.

- [ ] **Step 7: Run the whole support suite**

Run: `npx vitest run src/lib/support src/lib/brokerRegion.test.ts`
Expected: every test PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/telegram.ts src/lib/support/store.ts src/lib/support/run.ts src/lib/support/run.test.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): orchestrator — wait, flow-skip, member match, draft, guard, reply or hand off"
```

---

### Task 9: The webhook route

SendPulse posts **an array of events**. Each has `title` (`incoming_message` or `outgoing_message`), `contact.id`, `contact.username`, `contact.last_message` and `date`. The route only stores and triggers. `run.ts` re-reads the thread from the API.

Read first: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` and `.../03-file-conventions/route.md`.

**Files:**
- Create: `src/app/api/support/webhook/route.ts`, `src/app/api/support/webhook/route.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/support/webhook/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { runBurst, handleOutgoing, log } = vi.hoisted(() => ({
  runBurst: vi.fn(async () => ({ kind: "reply" })),
  handleOutgoing: vi.fn(async () => "ignored"),
  log: vi.fn(async () => true),
}));
vi.mock("@/lib/support/run", () => ({ runBurst, handleOutgoing }));
vi.mock("@/lib/support/store", () => ({ supabaseStore: () => ({ log }) }));
vi.mock("@/lib/channel/db", () => ({ adminDb: () => ({}) }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => { fn(); } }));

import { POST } from "./route";

const req = (body: unknown, key = "k") =>
  new Request(`https://app.test/api/support/webhook?key=${key}`, { method: "POST", body: JSON.stringify(body) });
const incoming = { title: "incoming_message", date: 1789460000, contact: { id: "c1", username: "sam", last_message: "hi" } };

beforeEach(() => {
  process.env.SUPPORT_WEBHOOK_SECRET = "k";
  runBurst.mockClear(); handleOutgoing.mockClear(); log.mockReset(); log.mockResolvedValue(true);
});

describe("POST /api/support/webhook", () => {
  it("rejects a wrong key with 401 and stores nothing", async () => {
    const res = await POST(req([incoming], "nope"));
    expect(res.status).toBe(401);
    expect(log).not.toHaveBeenCalled();
  });
  it("stores an incoming message and starts a run", async () => {
    const res = await POST(req([incoming]));
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ contact_id: "c1", kind: "incoming", member_text: "hi" }));
    expect(runBurst).toHaveBeenCalledWith("c1", new Date(1789460000 * 1000).toISOString());
  });
  it("drops a duplicate delivery", async () => {
    log.mockResolvedValueOnce(false);
    await POST(req([incoming]));
    expect(runBurst).not.toHaveBeenCalled();
  });
  it("routes outgoing messages to the quiet-period check", async () => {
    await POST(req([{ title: "outgoing_message", contact: { id: "c1" } }]));
    expect(handleOutgoing).toHaveBeenCalledWith("c1");
    expect(runBurst).not.toHaveBeenCalled();
  });
  it("accepts a single object as well as an array", async () => {
    await POST(req(incoming));
    expect(runBurst).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/app/api/support/webhook/route.test.ts`
Expected: FAIL, `Cannot find module './route'`.

- [ ] **Step 3: Implement the route**

`src/app/api/support/webhook/route.ts`:
```ts
import { NextResponse, after } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/channel/db";
import { supabaseStore } from "@/lib/support/store";
import { runBurst, handleOutgoing } from "@/lib/support/run";

export const runtime = "nodejs";
// 20 s burst wait + up to two Claude calls (35 s timeout each) + SendPulse calls.
export const maxDuration = 120;

// SendPulse chatbot webhook for @marketmakers18bot (Bot Settings → Webhooks,
// events incoming_message + outgoing_message). SendPulse doesn't sign webhooks,
// so the URL carries a long random ?key= compared in constant time.
function keyOk(given: string | null): boolean {
  const want = process.env.SUPPORT_WEBHOOK_SECRET;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

function eventTime(date: unknown): string {
  if (typeof date !== "number") return new Date().toISOString();
  return new Date(date < 1e12 ? date * 1000 : date).toISOString();
}

export async function POST(req: Request) {
  if (!keyOk(new URL(req.url).searchParams.get("key"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const events: any[] = Array.isArray(body) ? body : body ? [body] : [];
  const store = supabaseStore(adminDb());

  for (const ev of events) {
    const contactId = ev?.contact?.id ? String(ev.contact.id) : null;
    if (!contactId) continue;
    if (ev.title === "incoming_message") {
      const text = String(ev.contact.last_message ?? "");
      const at = eventTime(ev.date);
      const dedupe = createHash("sha256").update(`${contactId}|${ev.date ?? ""}|${text}`).digest("hex").slice(0, 32);
      const fresh = await store.log({ contact_id: contactId, kind: "incoming", dedupe_key: dedupe, member_text: text });
      if (fresh) after(async () => { await runBurst(contactId, at); });
    } else if (ev.title === "outgoing_message") {
      after(async () => { await handleOutgoing(contactId); });
    }
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Simplify `store.log`**

In `src/lib/support/store.ts`, replace the body of `log` with:
```ts
    async log(ev) {
      const { error } = await db.from("support_events").insert(ev);
      return !error; // false on a duplicate dedupe_key (23505) or any insert error
    },
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/app/api/support/webhook/route.test.ts && npx tsc --noEmit`
Expected: 5 tests PASS, and tsc exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/support/webhook src/lib/support/store.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): SendPulse webhook route (secret, dedupe, after() run)"
```

---

### Task 10: `/admin/support` — switch, fact sheet, queue, log

**Files:**
- Create: `src/lib/support/settingsForm.ts`, `src/lib/support/settingsForm.test.ts`, `src/app/admin/support/actions.ts`, `src/app/admin/support/page.tsx`
- Modify: `src/lib/support/sendpulse.ts` (add `deletePauseAutomation`), `src/components/AppShell.tsx` (`ADMIN_NAV`)

- [ ] **Step 1: Write the failing test for form parsing**

`src/lib/support/settingsForm.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseAccounts, parseFlows, accountsText, flowsText } from "./settingsForm";

describe("parseAccounts", () => {
  it("reads 'handle | label' lines, dropping @ and blank lines", () => {
    expect(parseAccounts("@MM_3000 | Admin Amelia\n\nMMFX_BOSS | Gordon's line\n")).toEqual([
      { handle: "MM_3000", label: "Admin Amelia" }, { handle: "MMFX_BOSS", label: "Gordon's line" },
    ]);
  });
  it("round-trips", () => {
    const a = [{ handle: "MM_3000", label: "Admin Amelia" }];
    expect(parseAccounts(accountsText(a))).toEqual(a);
  });
});

describe("parseFlows", () => {
  it("reads 'label | link or flow:ID | use when' lines", () => {
    expect(parseFlows("Bot | https://t.me/marketmakers18bot | someone wants to join\nJoin flow | flow:69d626007041a05eea073a86 | bot chats")).toEqual([
      { label: "Bot", link: "https://t.me/marketmakers18bot", use_when: "someone wants to join" },
      { label: "Join flow", flow_id: "69d626007041a05eea073a86", use_when: "bot chats" },
    ]);
  });
  it("ignores lines without three parts", () => {
    expect(parseFlows("just a label")).toEqual([]);
  });
  it("round-trips", () => {
    const f = [{ label: "Bot", link: "https://t.me/marketmakers18bot", use_when: "x" }];
    expect(parseFlows(flowsText(f))).toEqual(f);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/settingsForm.test.ts`
Expected: FAIL, `Cannot find module './settingsForm'`.

- [ ] **Step 3: Implement the parsers**

`src/lib/support/settingsForm.ts`:
```ts
import type { ApprovedFlow, OfficialAccount } from "./types";

// The /admin/support editor uses one line per item, fields separated by "|".
const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
const parts = (l: string) => l.split("|").map((p) => p.trim());

export function parseAccounts(text: string): OfficialAccount[] {
  return lines(text).map(parts).filter((p) => p.length >= 2 && p[0])
    .map(([handle, ...label]) => ({ handle: handle.replace(/^@/, ""), label: label.join(" | ") }));
}
export const accountsText = (a: OfficialAccount[]) => a.map((x) => `${x.handle} | ${x.label}`).join("\n");

export function parseFlows(text: string): ApprovedFlow[] {
  return lines(text).map(parts).filter((p) => p.length >= 3).map(([label, target, ...use]) => {
    const use_when = use.join(" | ");
    return target.startsWith("flow:") ? { label, flow_id: target.slice(5), use_when } : { label, link: target, use_when };
  });
}
export const flowsText = (f: ApprovedFlow[]) =>
  f.map((x) => `${x.label} | ${x.flow_id ? `flow:${x.flow_id}` : x.link ?? ""} | ${x.use_when}`).join("\n");
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/support/settingsForm.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Add `deletePauseAutomation` to the SendPulse client**

In `src/lib/support/sendpulse.ts`, after `setPauseAutomation`, add:
```ts
export const deletePauseAutomation = (contactId: string) =>
  post("/telegram/contacts/deletePauseAutomation", { contact_id: contactId });
```

- [ ] **Step 6: Write the server actions**

`src/app/admin/support/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/channel/db";
import { deleteTag, deletePauseAutomation } from "@/lib/support/sendpulse";
import { parseAccounts, parseFlows } from "@/lib/support/settingsForm";

async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || isAdmin !== true) throw new Error("Not authorized");
  return user.id;
}

export async function setEnabled(formData: FormData) {
  const uid = await requireAdmin();
  await adminDb().from("support_settings")
    .update({ enabled: formData.get("enabled") === "true", updated_by: uid, updated_at: new Date().toISOString() })
    .eq("id", 1);
  revalidatePath("/admin/support");
}

export async function saveSettings(formData: FormData) {
  const uid = await requireAdmin();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const expires = str("bonus_code_expires");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new Error("Bonus expiry must be a date (YYYY-MM-DD)");
  await adminDb().from("support_settings").update({
    bonus_code: str("bonus_code"),
    bonus_code_expires: expires,
    office_hours: str("office_hours"),
    trade_cadence: str("trade_cadence"),
    notes: str("notes"),
    official_accounts: parseAccounts(str("official_accounts")),
    approved_flows: parseFlows(str("approved_flows")),
    updated_by: uid,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  revalidatePath("/admin/support");
}

/** Hand a Needs-Amelia chat back to the agent. */
export async function clearChat(formData: FormData) {
  await requireAdmin();
  const contactId = String(formData.get("contact_id") ?? "");
  if (!contactId) return;
  await adminDb().from("support_chats")
    .update({ state: "auto", handoff_reason: null, quiet_until: null, updated_at: new Date().toISOString() })
    .eq("contact_id", contactId);
  await deleteTag(contactId, "needs-amelia");
  await deletePauseAutomation(contactId);
  revalidatePath("/admin/support");
}
```

- [ ] **Step 7: Write the page**

`src/app/admin/support/page.tsx`:
```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";
import { accountsText, flowsText } from "@/lib/support/settingsForm";
import type { SupportSettings } from "@/lib/support/types";
import { setEnabled, saveSettings, clearChat } from "./actions";

// Admin-only control room for the support agent: the switch, the editable part
// of the fact sheet (prices/tiers/links come from code), the Needs-Amelia
// queue and the activity log. Reads go through RLS (admins only).

export const dynamic = "force-dynamic";

interface ChatRow { contact_id: string; telegram_username: string | null; is_business: boolean; handoff_reason: string | null; updated_at: string }
interface EventRow { id: number; contact_id: string; kind: string; topic: string | null; member_text: string | null; reply_text: string | null; skip_reason: string | null; latency_ms: number | null; created_at: string }

const sgt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Singapore", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const cut = (s: string | null, n = 90) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? "");
function sgtMidnightIso(): string {
  const now = new Date(Date.now() + 8 * 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 3600_000).toISOString();
}
const field = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink";
const label = "text-[11px] font-semibold uppercase tracking-wider text-faint";

export default async function SupportAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || isAdmin !== true) {
    return <main className="p-10 text-[14px] text-subtle">Not authorized.</main>;
  }

  const [{ data: s }, { data: queue }, { data: events }] = await Promise.all([
    supabase.from("support_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("support_chats").select("contact_id, telegram_username, is_business, handoff_reason, updated_at")
      .eq("state", "needs_amelia").order("updated_at", { ascending: false }).limit(50),
    supabase.from("support_events").select("id, contact_id, kind, topic, member_text, reply_text, skip_reason, latency_ms, created_at")
      .order("created_at", { ascending: false }).limit(150),
  ]);
  const settings = s as SupportSettings | null;
  const log = (events ?? []) as EventRow[];
  const today = log.filter((e) => e.created_at >= sgtMidnightIso());
  const count = (k: string) => today.filter((e) => e.kind === k).length;
  const lat = today.filter((e) => e.kind === "reply" && e.latency_ms != null).map((e) => e.latency_ms!).sort((a, b) => a - b);
  const median = lat.length ? `${Math.round(lat[Math.floor(lat.length / 2)] / 1000)}s` : "—";

  return (
    <main className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/dashboard"><Wordmark /></Link>
        <Link href="/admin" className="text-[13px] font-semibold text-subtle hover:text-ink">← Admin</Link>
      </header>
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className={label}>Support agent</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              {settings?.enabled ? "On: answering members" : "Off: nothing is sent"}
            </h1>
          </div>
          <form action={setEnabled}>
            <input type="hidden" name="enabled" value={settings?.enabled ? "false" : "true"} />
            <button className={`rounded-xl px-5 py-2.5 text-[14px] font-semibold ${settings?.enabled ? "border border-line-strong bg-card text-ink" : "bg-orange text-white"}`}>
              {settings?.enabled ? "Turn off" : "Turn on"}
            </button>
          </form>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Replies today", count("reply")], ["Handed to Amelia", count("handoff")], ["Skipped", count("skip")], ["Median reply time", median]].map(([k, v]) => (
            <div key={String(k)} className="rounded-2xl border border-line bg-card p-4">
              <p className={label}>{k}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{v}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-bold text-ink">Needs Amelia ({queue?.length ?? 0})</h2>
          <ul className="mt-3 divide-y divide-line">
            {((queue ?? []) as ChatRow[]).map((c) => (
              <li key={c.contact_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13.5px]">
                <span className="text-ink">
                  {c.telegram_username ? `@${c.telegram_username}` : c.contact_id}
                  {c.is_business && <span className="ml-2 text-[11px] text-faint">@MM_3000 chat</span>}
                  <span className="block text-subtle">{c.handoff_reason} · {sgt(c.updated_at)}</span>
                </span>
                <form action={clearChat}>
                  <input type="hidden" name="contact_id" value={c.contact_id} />
                  <button className="rounded-lg border border-line-strong px-3 py-1.5 text-[12.5px] font-semibold text-ink">Done: back to the agent</button>
                </form>
              </li>
            ))}
            {!queue?.length && <li className="py-3 text-[13.5px] text-subtle">Nothing waiting.</li>}
          </ul>
        </section>

        {settings && (
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-display text-lg font-bold text-ink">Fact sheet: the editable part</h2>
            <p className="mt-1 text-[13px] text-subtle">Prices, tiers, features, the IB number and links come from the app&apos;s code, so they can&apos;t drift.</p>
            <form action={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1"><span className={label}>Octa/Elev8 bonus code</span><input name="bonus_code" defaultValue={settings.bonus_code} className={field} /></label>
              <label className="grid gap-1"><span className={label}>Code valid until</span><input name="bonus_code_expires" type="date" defaultValue={settings.bonus_code_expires} className={field} /></label>
              <label className="grid gap-1"><span className={label}>Office hours (human replies)</span><input name="office_hours" defaultValue={settings.office_hours} className={field} /></label>
              <label className="grid gap-1"><span className={label}>Trade cadence</span><input name="trade_cadence" defaultValue={settings.trade_cadence} className={field} /></label>
              <label className="grid gap-1 sm:col-span-2"><span className={label}>Official accounts, one per line: handle | label</span>
                <textarea name="official_accounts" rows={3} defaultValue={accountsText(settings.official_accounts)} className={field} /></label>
              <label className="grid gap-1 sm:col-span-2"><span className={label}>Approved flows, one per line: label | link or flow:ID | when to use</span>
                <textarea name="approved_flows" rows={3} defaultValue={flowsText(settings.approved_flows)} className={field} /></label>
              <label className="grid gap-1 sm:col-span-2"><span className={label}>Notes the agent may use</span>
                <textarea name="notes" rows={3} defaultValue={settings.notes} className={field} /></label>
              <div className="sm:col-span-2"><button className="rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white">Save fact sheet</button></div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-bold text-ink">Activity</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className={label}><tr><th className="py-2">Time (SGT)</th><th>What</th><th>Topic</th><th>Member</th><th>Sent / reason</th></tr></thead>
              <tbody className="divide-y divide-line">
                {log.filter((e) => e.kind !== "incoming").map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-subtle">{sgt(e.created_at)}</td>
                    <td className="pr-3 font-semibold text-ink">{e.kind}</td>
                    <td className="pr-3 text-subtle">{e.topic ?? ""}</td>
                    <td className="pr-3 text-ink">{cut(e.member_text)}</td>
                    <td className="text-subtle">{cut(e.reply_text ?? e.skip_reason, 120)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Link it in the sidebar**

In `src/components/AppShell.tsx`, add `ChatIcon` to the named imports from `"./icons"`, and add this line to `ADMIN_NAV` after the Channel Performance entry:
```ts
  { label: "Support Agent", href: "/admin/support", icon: ChatIcon },
```

- [ ] **Step 9: Typecheck and build**

Run: `npx tsc --noEmit && npx vitest run src/lib/support && npm run build`
Expected: tsc exits 0, tests PASS, and `next build` lists `/admin/support` and `/api/support/webhook`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/support/settingsForm.ts src/lib/support/settingsForm.test.ts src/lib/support/sendpulse.ts src/app/admin/support src/components/AppShell.tsx
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): /admin/support — switch, fact-sheet editor, Needs-Amelia queue, log"
```

---

### Task 11: Daily summary line and deposit-form copy

**Files:**
- Create: `src/lib/support/summary.ts`, `src/lib/support/summary.test.ts`
- Modify: `src/app/api/cron/daily-stats/route.ts`, `src/app/upgrade/DepositSubmitForm.tsx`

- [ ] **Step 1: Write the failing test**

`src/lib/support/summary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { supportLine } from "./summary";

describe("supportLine", () => {
  it("summarises the last 24 hours", () => {
    expect(supportLine({ replies: 42, handoffs: 5, waiting: 3, medianSeconds: 38 }))
      .toBe("<b>Support agent:</b> 42 replies · 5 handed to Amelia · 3 waiting · median reply 38s");
  });
  it("says so when there was no traffic", () => {
    expect(supportLine({ replies: 0, handoffs: 0, waiting: 0, medianSeconds: null }))
      .toBe("<b>Support agent:</b> no messages in the last 24h");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/support/summary.test.ts`
Expected: FAIL, `Cannot find module './summary'`.

- [ ] **Step 3: Implement the summary**

`src/lib/support/summary.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SupportStats { replies: number; handoffs: number; waiting: number; medianSeconds: number | null }

export function supportLine(s: SupportStats): string {
  if (!s.replies && !s.handoffs && !s.waiting) return "<b>Support agent:</b> no messages in the last 24h";
  return `<b>Support agent:</b> ${s.replies} replies · ${s.handoffs} handed to Amelia · ${s.waiting} waiting` +
    (s.medianSeconds != null ? ` · median reply ${s.medianSeconds}s` : "");
}

export async function supportStats(db: SupabaseClient, since: Date): Promise<SupportStats> {
  const [{ data: ev }, { count: waiting }] = await Promise.all([
    db.from("support_events").select("kind, latency_ms").in("kind", ["reply", "handoff"]).gte("created_at", since.toISOString()),
    db.from("support_chats").select("contact_id", { count: "exact", head: true }).eq("state", "needs_amelia"),
  ]);
  const rows = (ev ?? []) as { kind: string; latency_ms: number | null }[];
  const lat = rows.filter((r) => r.kind === "reply" && r.latency_ms != null).map((r) => r.latency_ms!).sort((a, b) => a - b);
  return {
    replies: rows.filter((r) => r.kind === "reply").length,
    handoffs: rows.filter((r) => r.kind === "handoff").length,
    waiting: waiting ?? 0,
    medianSeconds: lat.length ? Math.round(lat[Math.floor(lat.length / 2)] / 1000) : null,
  };
}
```

- [ ] **Step 4: Add the line to the 9am DM**

In `src/app/api/cron/daily-stats/route.ts`:
- Add the import: `import { supportLine, supportStats } from "@/lib/support/summary";`
- Change the `buildTelegram` signature to `function buildTelegram(m: GrowthMetrics, narrative: string | null, yest?: PriorSnapshot | null, support?: string | null): string`, and add `if (support) lines.push("", support);` directly above the `if (narrative) {` line.
- In `handle`, just before `const tg = await sendTelegram(buildTelegram(metrics, narrative, yesterday));`, add:
```ts
  const support = await supportStats(db, new Date(Date.now() - 24 * 3600_000)).then(supportLine).catch(() => null);
```
  and change that line to `const tg = await sendTelegram(buildTelegram(metrics, narrative, yesterday, support));`.

- [ ] **Step 5: Change the deposit-form step 1 copy**

In `src/app/upgrade/DepositSubmitForm.tsx`, replace:
```tsx
          Our admin can&apos;t message you first. Send this so we can reach you about your deposit.
```
with:
```tsx
          Once your top-up is in your trading account, send this so we can reach you about your deposit.
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run src/lib/support/summary.test.ts src/app/api/cron && npx tsc --noEmit`
Expected: PASS, and tsc exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/support/summary.ts src/lib/support/summary.test.ts src/app/api/cron/daily-stats/route.ts src/app/upgrade/DepositSubmitForm.tsx
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "feat(support-agent): support line in the 9am DM; message Amelia only after the top-up"
```

---

### Task 12: Replay on real history (dry run, nothing sent)

This runs the real facts, the real Claude call and the real guard over about 200 historical member questions from the 15 Sept export. Nothing is sent to anyone. It lives under `scripts/` as a vitest file so `@/` aliases and the `server-only` stub work, and it's skipped unless `SUPPORT_REPLAY=1`, so `npm test` never calls Claude.

**It spends Claude API credit: about 200–400 calls on `claude-opus-5`. Ask Gordon to approve before running Step 3.**

**Files:**
- Create: `scripts/support-replay.test.ts`

- [ ] **Step 1: Write the replay**

`scripts/support-replay.test.ts`:
```ts
import { describe, it } from "vitest";
import fs from "node:fs";
import { buildFactSheet } from "@/lib/support/facts";
import { checkDraft, mustHandOff } from "@/lib/support/guard";
import { decide } from "@/lib/support/agent";
import { adminDb } from "@/lib/channel/db";
import type { SupportSettings, ThreadMessage } from "@/lib/support/types";

// Usage: SUPPORT_REPLAY=1 SUPPORT_REPLAY_FILE=<pairs.jsonl> SUPPORT_REPLAY_OUT=<dir> npx vitest run scripts/support-replay.test.ts
// pairs.jsonl is the REDACTED export from the 15 Sept study ({ q, a } per line). Output stays outside the repo.
const RUN = process.env.SUPPORT_REPLAY === "1";

describe.skipIf(!RUN)("support replay", () => {
  it("runs the pipeline over historical questions", async () => {
    process.loadEnvFile?.(".env.local");
    const { data } = await adminDb().from("support_settings").select("*").eq("id", 1).single();
    const facts = buildFactSheet(data as SupportSettings);
    const all = fs.readFileSync(process.env.SUPPORT_REPLAY_FILE!, "utf8").trim().split("\n").map((l) => JSON.parse(l))
      .filter((p) => p.q && !/^\[[^\]]*\]$/.test(p.q));
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sample = [...all].sort(() => rnd() - 0.5).slice(0, 200);

    const rows: { q: string; outcome: string; topic?: string; reply?: string; reason?: string; guard?: string[] }[] = [];
    for (const p of sample) {
      const q = String(p.q).split(" | ").join("\n");
      const thread: ThreadMessage[] = [{ id: "1", direction: "in", fromFlow: false, text: q, at: new Date().toISOString() }];
      const contact = { id: "replay", username: null, firstName: "", isBusiness: false, tags: [] };
      const hard = mustHandOff(q, "other");
      if (hard) { rows.push({ q, outcome: "handoff", reason: hard }); continue; }
      const first = await decide({ facts, thread, contact, member: null });
      let d = first.decision;
      if (!d) { rows.push({ q, outcome: "handoff", reason: first.refused ? "refused" : `error ${first.error ?? ""}` }); continue; }
      if (d.action === "handoff" || d.confidence < 0.7 || mustHandOff(q, d.topic)) { rows.push({ q, outcome: "handoff", topic: d.topic, reason: d.reason }); continue; }
      let fails = checkDraft(d.reply, { facts, memberTexts: [q], member: null });
      if (fails.length) {
        const second = await decide({ facts, thread, contact, member: null, retryReasons: fails });
        if (second.decision && second.decision.action === "reply" && !checkDraft(second.decision.reply, { facts, memberTexts: [q], member: null }).length) {
          d = second.decision; fails = [];
        }
      }
      rows.push(fails.length ? { q, outcome: "handoff", topic: d.topic, reason: "guard", guard: fails } : { q, outcome: "reply", topic: d.topic, reply: d.reply });
    }

    const out = process.env.SUPPORT_REPLAY_OUT!;
    fs.writeFileSync(`${out}/support-replay.json`, JSON.stringify(rows, null, 2));
    const n = (o: string) => rows.filter((r) => r.outcome === o).length;
    const md = [
      `# Support agent replay (${rows.length} questions)`,
      `Replies: ${n("reply")} · Handoffs: ${n("handoff")} · Guard-blocked: ${rows.filter((r) => r.reason === "guard").length}`, "",
      "| Question | Outcome | Reply / reason |", "|---|---|---|",
      ...rows.slice(0, 60).map((r) => `| ${r.q.replace(/\n/g, " ").slice(0, 90)} | ${r.outcome}${r.topic ? ` (${r.topic})` : ""} | ${(r.reply ?? r.reason ?? "").replace(/\n/g, " ").slice(0, 160)} |`),
    ].join("\n");
    fs.writeFileSync(`${out}/support-replay.md`, md);
    console.log(md.split("\n").slice(0, 3).join("\n"));
  }, 60 * 60_000);
});
```

- [ ] **Step 2: Confirm the normal suite skips it**

Run: `npx vitest run scripts/support-replay.test.ts`
Expected: `1 skipped`, and no network calls.

- [ ] **Step 3: Run it (after Gordon approves the cost)**

```bash
SUPPORT_REPLAY=1 \
SUPPORT_REPLAY_FILE=/private/tmp/claude-501/-Users-gordon-Documents-Claude-mmfx-member-app/f00ed8d1-8298-4d03-bfda-67f81d757dca/scratchpad/sp/data/pairs.jsonl \
SUPPORT_REPLAY_OUT=/private/tmp/claude-501/-Users-gordon-Documents-Claude-mmfx-member-app/f00ed8d1-8298-4d03-bfda-67f81d757dca/scratchpad \
npx vitest run scripts/support-replay.test.ts
```
Expected: the summary lines print, and `support-replay.md` / `.json` land in the scratchpad.

- [ ] **Step 4: Review the report**

Read `support-replay.md`. Every reply must be factually right against the fact sheet, and every money or dispute question must be a handoff. For each wrong answer, fix the prompt rules in `agent.ts` or the facts text in `facts.ts` (or add a guard rule with a test), then re-run only if the fix was material. Show Gordon the summary and five sample replies before merging.

- [ ] **Step 5: Commit**

```bash
git add scripts/support-replay.test.ts
git -c user.name="gordon-518" -c user.email="gordon@marketmakersfx.net" commit -m "test(support-agent): dry-run replay over historical questions (opt-in)"
```

---

### Task 13: Final verification, PR, rollout

- [ ] **Step 1: Full check**

```bash
npx tsc --noEmit && npx vitest run && npx eslint src/lib/support src/app/api/support src/app/admin/support src/lib/brokerRegion.ts src/lib/brokerLinks.ts && npm run build
```
Expected: all clean, and the build includes `/admin/support` and `/api/support/webhook`.

- [ ] **Step 2: Push and open the PR (ask Gordon first)**

```bash
git push -u origin support-agent
gh pr create --base main --title "feat: automatic support agent for the SendPulse Telegram inbox" --body "$(cat <<'BODY'
Automatic replies for @marketmakers18bot and @MM_3000 (Telegram Business) chats, per docs/superpowers/specs/2026-09-15-support-agent-design.md.

- Facts read from code (tiers, features, lifetime plans, broker links, IB); bonus code + official accounts editable in /admin/support
- Claude (claude-opus-5, structured output, refusal fallbacks) drafts; code guard blocks wrong amounts/IB/codes/links/handles/profit language/deposit claims
- Money, disputes, deletion and low-confidence questions hand off to Admin Amelia (tag needs-amelia, bot paused, ping)
- Stays out when a SendPulse flow answered; quiet for 1h after Amelia replies; caps per chat and per day
- Switch is OFF by default

Migrations 20260915000010 and 20260915000011 are already applied to prod (apply scripts in scripts/).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

- [ ] **Step 3: Rollout checklist (after merge and deploy)**

1. **Vercel env vars:**
   - `SUPPORT_WEBHOOK_SECRET`: generate with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   - `SUPPORT_PING_CHAT_ID`: Amelia presses Start on @Mmwadatabot, then read her chat id from `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`.
   - `ANTHROPIC_API_KEY`: already set. Check that it's present in Production.

   Then redeploy.
2. **Gordon, in SendPulse:**
   - Turn off both **Standard reply** flows.
   - Point the **Join/SignUp** ending and the **TeamMM** join steps to `/upgrade`.
   - Bot Settings → Webhooks: add `https://app.marketmakersfx.net/api/support/webhook?key=<SUPPORT_WEBHOOK_SECRET>` for `incoming_message` and `outgoing_message`.
3. **Smoke test** from Gordon's Telegram, switch still off. Confirm `incoming` rows appear in `/admin/support` (logging works while off).
4. Switch **on**. Run the spec's day-1 checks in a bot chat and an @MM_3000 chat: a plans question, a questionnaire answer (left to the flow), a reference code, a withdrawal question (handoff), and a manual reply from Amelia (quiet period).
5. Record the answers to the spec's three "verify on day 1" questions in memory `mmfx-sendpulse-telegram-inbox`.
