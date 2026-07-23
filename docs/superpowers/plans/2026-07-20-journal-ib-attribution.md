# Journal IB Attribution & Leak Prevention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile connected journal accounts against Gordon's weekly broker IB exports so the journal only serves accounts under his IB — flagging (never auto-removing) leaks for manual review, all behind the existing admin-only gate.

**Architecture:** Two config/data tables (`ib_brokers`, `ib_accounts`) + two new `journal_accounts` columns. Pure, unit-tested parser (per-broker export normalization) and reconcile-diff functions. An admin page (`/journal/ib`) uploads the weekly export → preview diff (with guardrails) → full-replace allowlist + flag connected-but-absent accounts → downloadable enriched report → per-account manual removal (Type A journal-block, Type B full hand-off). The connect flow gains a broker dropdown, reads the account number from the member profile, and blocks reconnect of `journal_blocked` accounts.

**Tech Stack:** Next.js (app router) + TypeScript, Supabase (Postgres + RLS + service role), Vitest, SheetJS (`xlsx`) for server-side `.xls/.xlsx` parsing, existing MetaApi wrapper (`src/lib/journal/metaapi.ts`).

**Spec:** `docs/superpowers/specs/2026-07-20-journal-ib-attribution-design.md`

**Global constraint:** Everything stays admin-only. New API routes use `requireAdminApi`; the new page uses `requireFull()` + `if (!profile.is_admin) redirect("/dashboard")`; the nav entry is `adminOnly`. Nothing is exposed to non-admins.

---

## File Structure

**Create:**
- `supabase/migrations/20260720000001_journal_ib_attribution.sql` — tables, columns, seed, RLS.
- `scripts/apply-ib-attribution-migration.mjs` — apply migration to live DB (mirrors `scripts/apply-journal-migration.mjs`).
- `src/lib/journal/ibParse.ts` — pure export→logins normalizer.
- `src/lib/journal/ibParse.test.ts`
- `src/lib/journal/ibReconcile.ts` — pure reconcile diff + guardrails.
- `src/lib/journal/ibReconcile.test.ts`
- `src/lib/journal/ibBrokers.ts` — server helper: load broker registry + parse config, server↔broker check.
- `src/app/api/journal/ib/import/route.ts` — upload → preview/commit.
- `src/app/api/journal/ib/report/route.ts` — flagged-accounts CSV.
- `src/app/api/journal/accounts/[id]/ib-action/route.ts` — Type A / Type B removal.
- `src/app/journal/ib/page.tsx` — admin page (server component).
- `src/app/journal/ib/IbAdmin.tsx` — admin page client UI.

**Modify:**
- `src/lib/journal/types.ts` — add IB row/enum types.
- `src/app/api/journal/accounts/route.ts` — broker dropdown value, profile-derived login, gate.
- `src/app/journal/connect/ConnectWizard.tsx` — broker dropdown, profile account number, MT5-only copy.
- `src/app/journal/connect/page.tsx` — pass `tradingAccountNumber` + brokers to the wizard.
- `src/components/AppShell.tsx` — admin nav entry for `/journal/ib`.
- `package.json` — add `xlsx`.

---

## Task 1: Add the `xlsx` dependency

**Files:** Modify `package.json`.

- [ ] **Step 1: Install SheetJS**

Run: `npm install xlsx@0.18.5`
Expected: `package.json` gains `"xlsx": "0.18.5"`; `npm ls xlsx` resolves.

- [ ] **Step 2: Verify it imports server-side**

Run: `node -e "const x=require('xlsx'); console.log(typeof x.read)"`
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(journal): add xlsx for server-side IB export parsing"
```

---

## Task 2: Database migration + seed + RLS

**Files:**
- Create: `supabase/migrations/20260720000001_journal_ib_attribution.sql`
- Create: `scripts/apply-ib-attribution-migration.mjs`

- [ ] **Step 1: Write the migration SQL**

```sql
-- IB attribution: broker registry + per-IB account allowlist + review state.
-- Admin/service-role only. Traders never read/write these; all access is via
-- requireAdminApi-guarded routes using the service role.

create table if not exists public.ib_brokers (
  id text primary key,
  display_name text not null,
  enforcement_mode text not null default 'strict'
    check (enforcement_mode in ('strict', 'monitor')),
  parse_config jsonb not null default '{}'::jsonb,
  allowlist_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ib_accounts (
  broker_id text not null references public.ib_brokers(id) on delete cascade,
  mt5_login text not null,
  imported_at timestamptz not null default now(),
  primary key (broker_id, mt5_login)
);
create index if not exists ib_accounts_login_idx on public.ib_accounts (mt5_login);

alter table public.journal_accounts
  add column if not exists broker_id text references public.ib_brokers(id),
  add column if not exists ib_review text not null default 'ok'
    check (ib_review in ('ok', 'flagged', 'journal_blocked'));

-- Seed the two brokers. parse_config drives the pure parser (Task 3):
--   column: which export column holds the account id(s)
--   strip:  prefixes removed in order to reach the numeric MT5 login
--   split:  whether the cell holds multiple comma-separated accounts
insert into public.ib_brokers (id, display_name, enforcement_mode, parse_config) values
  ('dupoin', 'Dupoin', 'strict',
    '{"sheet":"ReferAccountListExcel","column":"Account","strip":[],"split":false}'::jsonb),
  ('elev8_octa', 'Elev8 / Octa', 'strict',
    '{"sheet":"Sheet1","column":"trading_account","strip":["Octa_","TA"],"split":true}'::jsonb)
on conflict (id) do nothing;

-- RLS: enable, add NO permissive policies. Deny-all to anon/authenticated;
-- the service role bypasses RLS, and every access path is a service-role query
-- inside a requireAdminApi-guarded route.
alter table public.ib_brokers enable row level security;
alter table public.ib_accounts enable row level security;
```

- [ ] **Step 2: Write the apply script**

```js
// One-off: apply the IB-attribution schema to the live DB via the IPv4 pooler.
// Mirrors scripts/apply-journal-migration.mjs. Idempotent.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync(
  new URL(
    "../supabase/migrations/20260720000001_journal_ib_attribution.sql",
    import.meta.url
  ),
  "utf8"
);

await client.connect();
await client.query(sql);
const { rows } = await client.query(
  "select id, display_name, enforcement_mode from public.ib_brokers order by id"
);
console.log("ib_brokers:", rows);
await client.end();
console.log("IB attribution migration applied.");
```

- [ ] **Step 3: Apply to the live DB**

Run: `node scripts/apply-ib-attribution-migration.mjs`
Expected: prints both seeded brokers (`dupoin`, `elev8_octa`) and "migration applied."

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260720000001_journal_ib_attribution.sql scripts/apply-ib-attribution-migration.mjs
git commit -m "feat(journal): IB attribution schema — ib_brokers, ib_accounts, review state"
```

---

## Task 3: Pure export parser (`ibParse.ts`)

**Files:**
- Create: `src/lib/journal/ibParse.ts`
- Test: `src/lib/journal/ibParse.test.ts`

- [ ] **Step 1: Write the failing test** (fixtures mirror the real Dupoin + Octa formats)

```ts
import { describe, expect, it } from "vitest";
import { normalizeLogin, parseIbRows, type BrokerParseConfig } from "./ibParse";

const DUPOIN: BrokerParseConfig = { column: "Account", strip: [], split: false };
const OCTA: BrokerParseConfig = {
  column: "trading_account",
  strip: ["Octa_", "TA"],
  split: true,
};

describe("normalizeLogin", () => {
  it("returns digits unchanged when no strip", () => {
    expect(normalizeLogin("2130873", [])).toBe("2130873");
  });
  it("strips TA prefix", () => {
    expect(normalizeLogin("TA22444243", ["Octa_", "TA"])).toBe("22444243");
  });
  it("strips Octa_TA prefix (in order)", () => {
    expect(normalizeLogin("Octa_TA17236344", ["Octa_", "TA"])).toBe("17236344");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeLogin("  TA202422 ", ["Octa_", "TA"])).toBe("202422");
  });
  it("rejects a token that isn't digits after stripping", () => {
    expect(normalizeLogin("N/A", ["Octa_", "TA"])).toBeNull();
    expect(normalizeLogin("", [])).toBeNull();
  });
});

describe("parseIbRows", () => {
  it("parses Dupoin single-column numeric logins", () => {
    const rows = [{ Account: "2130873" }, { Account: "2043071" }];
    const out = parseIbRows(rows, DUPOIN);
    expect(out.logins).toEqual(["2130873", "2043071"]);
    expect(out.skipped).toBe(0);
  });
  it("splits + normalizes + dedupes Octa multi-account cells", () => {
    const rows = [
      { trading_account: " TA22444243,  TA202422" },
      { trading_account: "Octa_TA17236344, TA22444243" }, // dup 22444243
    ];
    const out = parseIbRows(rows, OCTA);
    expect(out.logins).toEqual(["22444243", "202422", "17236344"]);
  });
  it("counts unparseable tokens as skipped, keeps the good ones", () => {
    const rows = [{ trading_account: "TA100, junk, Octa_TA200" }];
    const out = parseIbRows(rows, OCTA);
    expect(out.logins).toEqual(["100", "200"]);
    expect(out.skipped).toBe(1);
  });
  it("ignores rows with an empty target column", () => {
    const rows = [{ Account: null }, { Account: "2130873" }];
    const out = parseIbRows(rows, DUPOIN);
    expect(out.logins).toEqual(["2130873"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/journal/ibParse.test.ts`
Expected: FAIL — cannot find module `./ibParse`.

- [ ] **Step 3: Write the implementation**

```ts
// Pure normalization of a broker IB export (already read into row objects) into
// a deduped list of canonical MT5 logins. The xlsx→rows read happens in the API
// route (SheetJS); this stays pure and unit-tested against the real formats.

export interface BrokerParseConfig {
  /** Sheet name (used by the route when reading the workbook; not needed here). */
  sheet?: string;
  /** Column holding the account id(s). */
  column: string;
  /** Prefixes stripped in order to reach the numeric MT5 login (e.g. Octa_, TA). */
  strip: string[];
  /** Whether one cell can hold multiple comma-separated accounts. */
  split: boolean;
}

/** One raw token → canonical digits-only login, or null if it isn't one. */
export function normalizeLogin(token: string, strip: string[]): string | null {
  let s = String(token).trim();
  if (!s) return null;
  for (const prefix of strip) {
    if (s.startsWith(prefix)) s = s.slice(prefix.length);
  }
  return /^\d+$/.test(s) ? s : null;
}

export interface ParseResult {
  logins: string[];
  skipped: number;
}

/** Rows (column→value objects) + config → deduped canonical logins. */
export function parseIbRows(
  rows: Record<string, unknown>[],
  cfg: BrokerParseConfig
): ParseResult {
  const seen = new Set<string>();
  const logins: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const cell = row[cfg.column];
    if (cell === null || cell === undefined || String(cell).trim() === "")
      continue;
    const tokens = cfg.split ? String(cell).split(",") : [String(cell)];
    for (const t of tokens) {
      if (t.trim() === "") continue;
      const login = normalizeLogin(t, cfg.strip);
      if (login === null) {
        skipped += 1;
        continue;
      }
      if (!seen.has(login)) {
        seen.add(login);
        logins.push(login);
      }
    }
  }
  return { logins, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/journal/ibParse.test.ts`
Expected: PASS (all 9).

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/ibParse.ts src/lib/journal/ibParse.test.ts
git commit -m "feat(journal): pure IB export parser (Dupoin numeric, Octa TA-strip/split)"
```

---

## Task 4: Pure reconcile diff + guardrails (`ibReconcile.ts`)

**Files:**
- Create: `src/lib/journal/ibReconcile.ts`
- Test: `src/lib/journal/ibReconcile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { reconcile } from "./ibReconcile";

describe("reconcile", () => {
  it("computes added / removed / flaggedConnected", () => {
    const r = reconcile({
      currentAllowlist: ["100", "200", "300"],
      newList: ["200", "300", "400"],
      connectedLogins: ["100", "300"],
    });
    expect(r.added).toEqual(["400"]);
    expect(r.removed.sort()).toEqual(["100"]);
    expect(r.flaggedConnected).toEqual(["100"]); // connected but not in newList
  });

  it("flags the >20% removal guardrail", () => {
    const current = Array.from({ length: 100 }, (_, i) => String(i));
    const next = current.slice(0, 75); // drop 25%
    const r = reconcile({ currentAllowlist: current, newList: next, connectedLogins: [] });
    expect(r.removalPct).toBe(25);
    expect(r.guardRemoval).toBe(true);
  });

  it("flags the addition guardrail when the list balloons", () => {
    const r = reconcile(
      { currentAllowlist: ["1", "2"], newList: ["1", "2", "3", "4", "5", "6"], connectedLogins: [] },
      { additionThreshold: 100 }
    );
    expect(r.additionPct).toBe(200);
    expect(r.guardAddition).toBe(true);
  });

  it("first import (empty current) trips no guardrails", () => {
    const r = reconcile({ currentAllowlist: [], newList: ["1", "2", "3"], connectedLogins: [] });
    expect(r.guardRemoval).toBe(false);
    expect(r.guardAddition).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/journal/ibReconcile.test.ts`
Expected: FAIL — cannot find module `./ibReconcile`.

- [ ] **Step 3: Write the implementation**

```ts
// Pure reconcile of a broker's current allowlist against a freshly-parsed export.
// Also produces the connected accounts to flag, and the two safety guardrails.

export interface ReconcileInput {
  currentAllowlist: string[];
  newList: string[];
  connectedLogins: string[];
}

export interface ReconcileResult {
  added: string[];
  removed: string[];
  flaggedConnected: string[];
  removalPct: number;
  additionPct: number;
  guardRemoval: boolean;
  guardAddition: boolean;
}

const DEFAULT_REMOVAL_PCT = 20;
const DEFAULT_ADDITION_PCT = 50;

export function reconcile(
  input: ReconcileInput,
  opts: { removalThreshold?: number; additionThreshold?: number } = {}
): ReconcileResult {
  const removalThreshold = opts.removalThreshold ?? DEFAULT_REMOVAL_PCT;
  const additionThreshold = opts.additionThreshold ?? DEFAULT_ADDITION_PCT;

  const current = new Set(input.currentAllowlist);
  const next = new Set(input.newList);

  const added = input.newList.filter((l) => !current.has(l));
  const removed = input.currentAllowlist.filter((l) => !next.has(l));
  const flaggedConnected = input.connectedLogins.filter((l) => !next.has(l));

  // First import (nothing to compare against) trips no guardrails.
  const base = input.currentAllowlist.length;
  const removalPct = base === 0 ? 0 : Math.round((removed.length / base) * 100);
  const additionPct = base === 0 ? 0 : Math.round((added.length / base) * 100);

  return {
    added,
    removed,
    flaggedConnected,
    removalPct,
    additionPct,
    guardRemoval: removalPct > removalThreshold,
    guardAddition: additionPct > additionThreshold,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/journal/ibReconcile.test.ts`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/ibReconcile.ts src/lib/journal/ibReconcile.test.ts
git commit -m "feat(journal): pure IB reconcile diff + removal/addition guardrails"
```

---

## Task 5: Types + broker server helper

**Files:**
- Modify: `src/lib/journal/types.ts` (append)
- Create: `src/lib/journal/ibBrokers.ts`

- [ ] **Step 1: Append IB types to `types.ts`**

```ts
// --- IB attribution ---------------------------------------------------------

export type IbReview = "ok" | "flagged" | "journal_blocked";

export interface IbBrokerRow {
  id: string;
  display_name: string;
  enforcement_mode: "strict" | "monitor";
  parse_config: {
    sheet?: string;
    column: string;
    strip: string[];
    split: boolean;
  };
  allowlist_updated_at: string | null;
}
```

- [ ] **Step 2: Create `ibBrokers.ts` (server helper)**

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IbBrokerRow } from "./types";

/** Load the broker registry (service-role client). */
export async function loadBrokers(db: SupabaseClient): Promise<IbBrokerRow[]> {
  const { data } = await db
    .from("ib_brokers")
    .select("id, display_name, enforcement_mode, parse_config, allowlist_updated_at")
    .order("id");
  return (data ?? []) as IbBrokerRow[];
}

/**
 * Soft check that a free-text server string is consistent with the selected
 * broker — closes the "pick the other broker to dodge the reconcile" hole.
 * Returns true if it's fine or we can't tell; false only on a clear conflict.
 */
export function serverMatchesBroker(server: string, brokerId: string): boolean {
  const s = server.toLowerCase();
  const mentions = {
    dupoin: s.includes("dupoin"),
    elev8_octa: s.includes("elev8") || s.includes("octa"),
  } as Record<string, boolean>;
  const thisBroker = mentions[brokerId] ?? false;
  const otherBroker = Object.entries(mentions).some(
    ([id, hit]) => id !== brokerId && hit
  );
  // Conflict only when the server clearly names a DIFFERENT broker and not this one.
  return !(otherBroker && !thisBroker);
}
```

- [ ] **Step 3: Quick sanity test for `serverMatchesBroker`**

Create `src/lib/journal/ibBrokers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { serverMatchesBroker } from "./ibBrokers";

describe("serverMatchesBroker", () => {
  it("accepts a matching server", () => {
    expect(serverMatchesBroker("Elev8-Demo2", "elev8_octa")).toBe(true);
    expect(serverMatchesBroker("Dupoin-Live", "dupoin")).toBe(true);
  });
  it("rejects a clearly-mismatched server", () => {
    expect(serverMatchesBroker("Dupoin-Live", "elev8_octa")).toBe(false);
  });
  it("is lenient when the server names no known broker", () => {
    expect(serverMatchesBroker("MT5-Server-01", "dupoin")).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/journal/ibBrokers.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/types.ts src/lib/journal/ibBrokers.ts src/lib/journal/ibBrokers.test.ts
git commit -m "feat(journal): IB types + broker registry helper + server/broker check"
```

---

## Task 6: Connect API gate (broker + profile login + blocklist)

**Files:** Modify `src/app/api/journal/accounts/route.ts`.

- [ ] **Step 1: Rewrite the POST handler body**

Replace the `ConnectBody` interface and the validation/upsert block with the version below. Key changes: `broker_id` comes from the request; **`login` is taken from the member profile (`trading_account_number`)**, not the client; add the server↔broker check; reject reconnect of a `journal_blocked` account; store `broker_id`.

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { MetaApiError, createMetaApiAccount } from "@/lib/journal/metaapi";
import { loadBrokers, serverMatchesBroker } from "@/lib/journal/ibBrokers";

interface ConnectBody {
  broker_id?: string;
  password?: string;
  server?: string;
  label?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  // The journal tracks the member's one registered active account.
  const login = (profile.trading_account_number ?? "").trim();
  if (!/^\d{4,15}$/.test(login)) {
    return NextResponse.json(
      { error: "Add your trading account number to your profile first." },
      { status: 400 }
    );
  }

  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brokerId = (body.broker_id ?? "").trim();
  const password = body.password ?? "";
  const server = (body.server ?? "").trim();
  const label = (body.label ?? "").trim() || null;

  const svc = serviceClient();
  const brokers = await loadBrokers(svc);
  const broker = brokers.find((b) => b.id === brokerId);
  if (!broker) {
    return NextResponse.json({ error: "Choose your broker" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Investor password is required" },
      { status: 400 }
    );
  }
  if (server.length < 3) {
    return NextResponse.json(
      { error: "Broker server is required (from your MT5 login screen)" },
      { status: 400 }
    );
  }
  if (!serverMatchesBroker(server, brokerId)) {
    return NextResponse.json(
      { error: `That server doesn't look like a ${broker.display_name} server.` },
      { status: 400 }
    );
  }

  // Block reconnect of an account previously removed as not-under-IB.
  const { data: prior } = await svc
    .from("journal_accounts")
    .select("id, ib_review")
    .eq("mt5_login", login)
    .eq("broker_id", brokerId)
    .maybeSingle();
  if (prior?.ib_review === "journal_blocked") {
    return NextResponse.json(
      { error: "This account can't be connected. Please contact support." },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("journal_accounts")
    .select("id, state")
    .eq("mt5_login", login)
    .eq("broker_id", brokerId)
    .maybeSingle();
  if (existing && ["connecting", "deployed"].includes(existing.state)) {
    return NextResponse.json(
      { error: "This account is already connected" },
      { status: 409 }
    );
  }

  let metaapiAccountId: string | null = null;
  let state = "connecting";
  let stateDetail: string | null = null;
  try {
    const created = await createMetaApiAccount({
      login,
      password,
      server,
      name: `mmfx-${profile.id.slice(0, 8)}-${login}`,
    });
    metaapiAccountId = created.id;
  } catch (e) {
    state = "failed";
    stateDetail =
      e instanceof MetaApiError
        ? `MetaApi: ${e.message}`
        : "Could not reach MetaApi — please try again";
  }

  const { data: account, error } = await supabase
    .from("journal_accounts")
    .upsert(
      {
        user_id: profile.id,
        label,
        mt5_login: login,
        broker_server: server,
        broker_id: brokerId,
        ib_review: "ok",
        metaapi_account_id: metaapiAccountId,
        state,
        state_detail: stateDetail,
        sync_error: null,
        disconnected_at: null,
      },
      { onConflict: "user_id,mt5_login,broker_server" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (state === "connecting") {
    await serviceClient()
      .from("journal_sync_jobs")
      .insert({ account_id: account.id });
  }
  return NextResponse.json({ account }, { status: state === "failed" ? 502 : 201 });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Run the journal suite (nothing broken)**

Run: `npx vitest run src/lib/journal`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/journal/accounts/route.ts
git commit -m "feat(journal): connect gate — broker choice, profile-derived login, blocklist"
```

---

## Task 7: Connect wizard UI (broker dropdown + profile account)

**Files:**
- Modify: `src/app/journal/connect/ConnectWizard.tsx`
- Modify: `src/app/journal/connect/page.tsx`

- [ ] **Step 1: Update the page to pass account number + brokers**

In `src/app/journal/connect/page.tsx`, after loading `goals`, load brokers via the service role and pass props. Add near the top:

```ts
import { serviceClient } from "@/lib/journal/api";
import { loadBrokers } from "@/lib/journal/ibBrokers";
```

Replace the `return (<AppShell...><ConnectWizard .../></AppShell>)` block with:

```tsx
  const brokers = await loadBrokers(serviceClient());

  return (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      tier="Full"
      isAdmin
    >
      <ConnectWizard
        initialStep={step === "goals" ? "goals" : "credentials"}
        initialGoals={(goals ?? null) as JournalGoalsRow | null}
        tradingAccountNumber={profile.trading_account_number}
        brokers={brokers.map((b) => ({ id: b.id, name: b.display_name }))}
      />
    </AppShell>
  );
```

- [ ] **Step 2: Update `ConnectWizard.tsx` — props + credentials step**

Change the `ConnectWizard` component signature and `CredentialsStep` to (a) accept `tradingAccountNumber` + `brokers`, (b) show the account number read-only, (c) replace the free-text server-only flow with a **broker `<select>`** plus the (still free-text) server, (d) post `broker_id` instead of `login`.

Update the top-level component props (find `export function ConnectWizard({ initialStep, initialGoals })` and extend):

```tsx
export function ConnectWizard({
  initialStep,
  initialGoals,
  tradingAccountNumber,
  brokers,
}: {
  initialStep: Step;
  initialGoals: JournalGoalsRow | null;
  tradingAccountNumber: string | null;
  brokers: { id: string; name: string }[];
}) {
  // ...existing body; pass the two new props down to <CredentialsStep/>.
}
```

Replace `CredentialsStep` with:

```tsx
function CredentialsStep({
  tradingAccountNumber,
  brokers,
  onDone,
}: {
  tradingAccountNumber: string | null;
  brokers: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [brokerId, setBrokerId] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tradingAccountNumber) {
    return (
      <p className="text-[14px] text-ink">
        Add your MT5 trading account number to your profile first, then come back
        to connect the journal.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journal/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker_id: brokerId, password, server, label }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Connection failed — please try again");
        return;
      }
      onDone();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls}>MT5 account number</label>
        <input
          className={`${inputCls} mt-1.5 bg-canvas/60`}
          value={tradingAccountNumber}
          readOnly
          aria-readonly
        />
        <p className="mt-1.5 text-[12px] text-subtle">
          Your registered active MT5 account. To change it, update your trading
          account number in your profile. Only MT5 trading accounts can be
          connected.
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-broker">
          Broker
        </label>
        <select
          id="mt5-broker"
          className={`${inputCls} mt-1.5`}
          value={brokerId}
          onChange={(e) => setBrokerId(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose your broker
          </option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-password">
          Investor password (read-only)
        </label>
        <input
          id="mt5-password"
          className={`${inputCls} mt-1.5`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your investor password — not the master password"
          required
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-subtle">
          The investor password only allows viewing — no trading, no withdrawals.
          It is passed securely to our sync provider and{" "}
          <span className="font-semibold">never stored</span>.
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-server">
          Broker server
        </label>
        <input
          id="mt5-server"
          className={`${inputCls} mt-1.5`}
          value={server}
          onChange={(e) => setServer(e.target.value)}
          placeholder="e.g. Elev8-Live (shown on your MT5 login screen)"
          required
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="mt5-label">
          Nickname <span className="font-normal text-subtle">(optional)</span>
        </label>
        <input
          id="mt5-label"
          className={`${inputCls} mt-1.5`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Main account"
          maxLength={60}
        />
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Connecting…" : "Connect account"}
        </button>
        <Link href="/journal" className="text-[13px] text-subtle hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
```

Also update the call site of `<CredentialsStep .../>` inside `ConnectWizard` to pass `tradingAccountNumber={tradingAccountNumber}` and `brokers={brokers}`.

- [ ] **Step 3: Typecheck + build the journal route**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/journal/connect/ConnectWizard.tsx src/app/journal/connect/page.tsx
git commit -m "feat(journal): connect wizard — broker dropdown + profile account number"
```

---

## Task 8: Import route (preview + commit reconcile)

**Files:** Create `src/app/api/journal/ib/import/route.ts`.

- [ ] **Step 1: Write the route**

Accepts `multipart/form-data`: `file` (the export), `broker_id`, `mode` (`preview`|`commit`), `override` (`"1"` to bypass guardrails). Preview returns the diff; commit full-replaces the allowlist, flags connected-but-absent accounts, and stamps `allowlist_updated_at`.

```ts
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { loadBrokers } from "@/lib/journal/ibBrokers";
import { parseIbRows } from "@/lib/journal/ibParse";
import { reconcile } from "@/lib/journal/ibReconcile";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;

  const form = await req.formData();
  const brokerId = String(form.get("broker_id") ?? "");
  const mode = String(form.get("mode") ?? "preview");
  const override = String(form.get("override") ?? "") === "1";
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const svc = serviceClient();
  const broker = (await loadBrokers(svc)).find((b) => b.id === brokerId);
  if (!broker) {
    return NextResponse.json({ error: "Unknown broker" }, { status: 400 });
  }

  // Read the workbook → rows for the configured sheet.
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = broker.parse_config.sheet ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return NextResponse.json(
      { error: `Sheet "${sheetName}" not found in the file` },
      { status: 400 }
    );
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
  const parsed = parseIbRows(rows, broker.parse_config);

  // Current allowlist for this broker — PAGINATE past PostgREST's 1000-row cap
  // (elev8_octa holds ~12k; a plain select would silently truncate and corrupt
  // the diff — same bug class as sync.ts fetchStoredDealsForPositions).
  const currentAllowlist: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await svc
      .from("ib_accounts")
      .select("mt5_login")
      .eq("broker_id", brokerId)
      .range(from, from + 999);
    const batch = (data ?? []).map((r) => r.mt5_login as string);
    currentAllowlist.push(...batch);
    if (batch.length < 1000) break;
  }

  const { data: connRows } = await svc
    .from("journal_accounts")
    .select("mt5_login")
    .eq("broker_id", brokerId)
    .in("state", ["connecting", "deployed"]);
  const connectedLogins = (connRows ?? []).map((r) => r.mt5_login as string);

  const result = reconcile({
    currentAllowlist,
    newList: parsed.logins,
    connectedLogins,
  });

  const preview = {
    parsedCount: parsed.logins.length,
    skipped: parsed.skipped,
    sample: parsed.logins.slice(0, 10),
    referrerHint:
      brokerId === "elev8_octa"
        ? String((rows[0] as Record<string, unknown>)?.unique_referrer_id ?? "")
        : null,
    added: result.added.length,
    removed: result.removed.length,
    flaggedConnected: result.flaggedConnected,
    guardRemoval: result.guardRemoval,
    guardAddition: result.guardAddition,
    removalPct: result.removalPct,
    additionPct: result.additionPct,
  };

  if (mode !== "commit") {
    return NextResponse.json({ mode: "preview", ...preview });
  }

  if ((result.guardRemoval || result.guardAddition) && !override) {
    return NextResponse.json(
      { mode: "blocked", ...preview, needOverride: true },
      { status: 409 }
    );
  }

  // Commit: full-replace this broker's allowlist.
  await svc.from("ib_accounts").delete().eq("broker_id", brokerId);
  if (parsed.logins.length > 0) {
    const CHUNK = 1000;
    for (let i = 0; i < parsed.logins.length; i += CHUNK) {
      const batch = parsed.logins
        .slice(i, i + CHUNK)
        .map((mt5_login) => ({ broker_id: brokerId, mt5_login }));
      const { error } = await svc.from("ib_accounts").insert(batch);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // Flag connected accounts not in the new list (only bump ok → flagged; never
  // downgrade a journal_blocked). Clear a stale flag for any that reappeared.
  if (result.flaggedConnected.length > 0) {
    await svc
      .from("journal_accounts")
      .update({ ib_review: "flagged" })
      .eq("broker_id", brokerId)
      .eq("ib_review", "ok")
      .in("mt5_login", result.flaggedConnected);
  }
  // Clear a stale `flagged` for connected accounts that reappeared in the list.
  // Operate on the small CONNECTED set (not the ~12k parsed list — an .in() with
  // 12k values would blow the request URL). `reappeared` = connected minus newly-flagged.
  const flaggedSet = new Set(result.flaggedConnected);
  const reappeared = connectedLogins.filter((l) => !flaggedSet.has(l));
  if (reappeared.length > 0) {
    await svc
      .from("journal_accounts")
      .update({ ib_review: "ok" })
      .eq("broker_id", brokerId)
      .eq("ib_review", "flagged")
      .in("mt5_login", reappeared);
  }

  await svc
    .from("ib_brokers")
    .update({ allowlist_updated_at: new Date().toISOString() })
    .eq("id", brokerId);

  return NextResponse.json({ mode: "committed", ...preview });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/journal/ib/import/route.ts
git commit -m "feat(journal): IB export import route — preview diff, guardrails, full-replace + flag"
```

---

## Task 9: Flagged-accounts report (CSV) + removal actions

**Files:**
- Create: `src/app/api/journal/ib/report/route.ts`
- Create: `src/app/api/journal/accounts/[id]/ib-action/route.ts`

- [ ] **Step 1: Write the report route (enriched CSV of flagged accounts)**

```ts
import { NextResponse } from "next/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const svc = serviceClient();

  const { data: accounts } = await svc
    .from("journal_accounts")
    .select(
      "id, user_id, mt5_login, broker_id, broker_server, balance, equity, currency, last_synced_at, ib_review"
    )
    .eq("ib_review", "flagged");

  const rows = accounts ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const { data: profiles } = await svc
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds.length ? userIds : ["__none__"]);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p])
  );

  const header = [
    "account_id",
    "mt5_login",
    "broker",
    "server",
    "member_name",
    "member_email",
    "balance",
    "equity",
    "currency",
    "last_synced_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const p = nameById.get(r.user_id as string);
    lines.push(
      [
        r.id,
        r.mt5_login,
        r.broker_id,
        r.broker_server,
        p?.full_name ?? "",
        p?.email ?? "",
        r.balance,
        r.equity,
        r.currency,
        r.last_synced_at,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ib-flagged-accounts.csv"`,
    },
  });
}
```

> Note: adjust the `profiles` name column (`full_name`) to the real column if it differs — grep `profiles` select usage elsewhere and match.

- [ ] **Step 2: Write the removal-action route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { deleteMetaApiAccount } from "@/lib/journal/metaapi";

// Type A: block journal + remove MetaApi, keep the app account.
// Type B: same journal-side removal; app-level removal is handed off to the
//         existing admin user-management (this route returns user_id for the link).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  let body: { action?: "block_journal" | "full_removal" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "block_journal" && action !== "full_removal") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: account } = await svc
    .from("journal_accounts")
    .select("id, user_id, metaapi_account_id")
    .eq("id", id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Stop MetaApi cost (best-effort — deletion is what stops billing).
  if (account.metaapi_account_id) {
    try {
      await deleteMetaApiAccount(account.metaapi_account_id);
    } catch {
      // leave for retry; still mark journal-blocked below
    }
  }

  await svc
    .from("journal_accounts")
    .update({
      ib_review: "journal_blocked",
      state: "disconnected",
      disconnected_at: new Date().toISOString(),
      metaapi_account_id: null,
    })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    action,
    userId: account.user_id,
    // For full_removal the admin UI links to the existing user-management page
    // to remove app access — the journal does not touch account_status.
    handoff: action === "full_removal" ? `/admin/users?user=${account.user_id}` : null,
  });
}
```

> Note: confirm the admin user-management path (`/admin/users`) against `docs/superpowers/specs/2026-07-01-onboarding-roadmap-and-admin-usermgmt-design.md`; adjust the `handoff` URL to the real route.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/journal/ib/report/route.ts "src/app/api/journal/accounts/[id]/ib-action/route.ts"
git commit -m "feat(journal): flagged-accounts CSV report + Type A/B removal actions"
```

---

## Task 10: Admin page `/journal/ib`

**Files:**
- Create: `src/app/journal/ib/page.tsx`
- Create: `src/app/journal/ib/IbAdmin.tsx`

- [ ] **Step 1: Write the server page (admin-gated, loads brokers + flagged)**

```tsx
import { redirect } from "next/navigation";
import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { serviceClient } from "@/lib/journal/api";
import { loadBrokers } from "@/lib/journal/ibBrokers";
import { IbAdmin } from "./IbAdmin";

export default async function JournalIbPage() {
  const profile = await requireFull();
  if (!profile.is_admin) redirect("/dashboard");

  const svc = serviceClient();
  const brokers = await loadBrokers(svc);
  const { data: flagged } = await svc
    .from("journal_accounts")
    .select("id, mt5_login, broker_id, broker_server, balance, currency, last_synced_at")
    .eq("ib_review", "flagged");

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full" isAdmin>
      <IbAdmin
        brokers={brokers.map((b) => ({
          id: b.id,
          name: b.display_name,
          mode: b.enforcement_mode,
          updatedAt: b.allowlist_updated_at,
        }))}
        flagged={flagged ?? []}
      />
    </AppShell>
  );
}
```

- [ ] **Step 2: Write the client UI**

`IbAdmin.tsx`: per-broker upload card (file input → preview → confirm, with override on guardrail + staleness line), a flagged-accounts table with **Block journal (A)** / **Full removal (B)** buttons, and a **Download report** link. Uses `fetch` to the routes from Tasks 8–9.

```tsx
"use client";

import { useState } from "react";

type Broker = { id: string; name: string; mode: string; updatedAt: string | null };
type Flagged = {
  id: string;
  mt5_login: string;
  broker_id: string;
  broker_server: string;
  balance: number | null;
  currency: string | null;
  last_synced_at: string | null;
};

const card =
  "rounded-2xl border border-line-strong bg-card p-5 shadow-soft space-y-3";
const btn =
  "cursor-pointer rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#f24e12] disabled:opacity-50";
const ghost =
  "cursor-pointer rounded-xl border border-line-strong px-3 py-2 text-[13px] font-semibold text-ink hover:border-orange/40";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function BrokerCard({ broker }: { broker: Broker }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stale = daysSince(broker.updatedAt);

  async function send(mode: "preview" | "commit", override = false) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("broker_id", broker.id);
    fd.set("mode", mode);
    if (override) fd.set("override", "1");
    const res = await fetch("/api/journal/ib/import", { method: "POST", body: fd });
    const body = await res.json();
    setBusy(false);
    if (body.mode === "committed") {
      setPreview(null);
      setMsg(`Committed: ${body.parsedCount} accounts, ${body.flaggedConnected?.length ?? 0} flagged.`);
    } else {
      setPreview(body);
      if (body.needOverride) setMsg("Guardrail tripped — review, then Confirm anyway.");
    }
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">{broker.name}</h3>
        <span className="text-[12px] text-subtle">
          {broker.mode} ·{" "}
          {stale === null ? "never imported" : `updated ${stale}d ago`}
          {stale !== null && stale > 10 ? " ⚠️" : ""}
        </span>
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="text-[13px]"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex gap-2">
        <button className={ghost} disabled={!file || busy} onClick={() => send("preview")}>
          Preview
        </button>
        {preview && !preview.needOverride && (
          <button className={btn} disabled={busy} onClick={() => send("commit")}>
            Confirm &amp; import
          </button>
        )}
        {preview?.needOverride ? (
          <button className={btn} disabled={busy} onClick={() => send("commit", true)}>
            Confirm anyway (override)
          </button>
        ) : null}
      </div>
      {preview && (
        <div className="rounded-xl bg-canvas/60 p-3 text-[12px] text-ink">
          <div>Parsed: {String(preview.parsedCount)} · skipped: {String(preview.skipped)}</div>
          <div>+{String(preview.added)} added · −{String(preview.removed)} removed ({String(preview.removalPct)}%)</div>
          <div>Will flag {(preview.flaggedConnected as string[])?.length ?? 0} connected accounts</div>
          <div className="mt-1 text-subtle">Sample: {(preview.sample as string[])?.join(", ")}</div>
          {preview.referrerHint ? (
            <div className="text-subtle">Referrer id in file: {String(preview.referrerHint)}</div>
          ) : null}
        </div>
      )}
      {msg && <p className="text-[13px] text-ink">{msg}</p>}
    </div>
  );
}

export function IbAdmin({ brokers, flagged }: { brokers: Broker[]; flagged: Flagged[] }) {
  const [rows, setRows] = useState(flagged);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "block_journal" | "full_removal") {
    setBusyId(id);
    const res = await fetch(`/api/journal/accounts/${id}/ib-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json();
    setBusyId(null);
    if (res.ok) {
      setRows((r) => r.filter((x) => x.id !== id));
      if (body.handoff) window.open(body.handoff, "_blank");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-ink">IB reconciliation</h1>
        <p className="text-[13px] text-subtle">
          Upload each broker&apos;s weekly export. Accounts not in the list are
          flagged for manual review — nothing is removed automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {brokers.map((b) => (
          <BrokerCard key={b.id} broker={b} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-ink">
          Flagged accounts ({rows.length})
        </h2>
        <a className={ghost} href="/api/journal/ib/report">
          Download CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line-strong">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas/60 text-left text-subtle">
            <tr>
              <th className="p-3">Login</th>
              <th className="p-3">Broker</th>
              <th className="p-3">Balance</th>
              <th className="p-3">Last sync</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="p-3 font-mono">{r.mt5_login}</td>
                <td className="p-3">{r.broker_id}</td>
                <td className="p-3">
                  {r.balance ?? "—"} {r.currency ?? ""}
                </td>
                <td className="p-3">
                  {r.last_synced_at ? new Date(r.last_synced_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      className={ghost}
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "block_journal")}
                    >
                      Block journal (A)
                    </button>
                    <button
                      className={ghost}
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "full_removal")}
                    >
                      Full removal (B)
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-subtle" colSpan={5}>
                  No flagged accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/journal/ib/page.tsx src/app/journal/ib/IbAdmin.tsx
git commit -m "feat(journal): /journal/ib admin — upload/reconcile, flagged review, removal actions"
```

---

## Task 11: Admin nav entry

**Files:** Modify `src/components/AppShell.tsx`.

- [ ] **Step 1: Add the nav item**

Find the existing journal nav entry (the one with `adminOnly: true` for `/journal`). Add an adjacent admin-only entry for the IB page, matching the existing item shape:

```tsx
{ href: "/journal/ib", label: "IB reconciliation", adminOnly: true },
```

(Match the exact object shape/icon convention used by the existing entries in that file.)

- [ ] **Step 2: Typecheck + dev smoke**

Run: `npx tsc --noEmit`
Expected: exit 0.

Then run the app and confirm `/journal/ib` renders for the admin and 404s/redirects for a non-admin (manual check via the browser preview).

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(journal): admin nav entry for IB reconciliation"
```

---

## Task 12: Full verification

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: PASS (existing + new IB tests).

- [ ] **Step 2: Typecheck + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0, build succeeds.

- [ ] **Step 3: End-to-end smoke (admin, against live DB via `.env.local`)**

- Upload the real Dupoin `.xls` in `/journal/ib` → preview shows ~570 parsed, sample numeric → Confirm → `ib_accounts` for `dupoin` populated; `allowlist_updated_at` set.
- Upload the real Octa `.xlsx` → preview shows ~12k parsed, sample digits (TA-stripped) → Confirm.
- Reconnect the test account (login = profile `trading_account_number`, broker Elev8/Octa) → still works.
- Confirm the flagged table + CSV download render.

- [ ] **Step 4: Commit any fixups, then push**

```bash
git add -A && git commit -m "chore(journal): IB attribution verification fixups" || true
git push origin main
```

---

## Deferred (not in this plan; noted in spec open items)

- **Account-switch handling** (spec §Account-switch): auto-detect when a member's
  `trading_account_number` changed vs their connected journal login, disconnect the
  stale account, and prompt to re-authorize. Secondary flow — not part of the core
  leak-prevention, and low-frequency (account switches are rare). Since the connect
  login is now derived from the profile, a switched member simply reconnects; the
  auto-detect/disconnect is a UX nicety to add next. Conscious deferral — confirm.
- **`member_active` hard-gate on the journal:** while the journal is admin-only the
  effective gate is "has a `trading_account_number`" (Task 6). The explicit
  `account_status === 'member_active'` requirement belongs with the public rollout
  (it would otherwise block the admin tester, who isn't `member_active`).
- Scheduled weekly "upload your export" reminder (cron/routine).
- Automatic `journal_blocked` auto-heal on reappearance (currently the import clears a stale `flagged`, but a `journal_blocked` account stays blocked until manually reinstated — add a manual "reinstate" button later if needed).
