# Survival Engine — Layer 3 (Proactive Interventions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reach out to traders proactively — a critical blow-up email, a weekly-focus email, and a 10-day inactivity nudge — plus an in-app banner, all driven by the L1/L2 signals, admin-gated during rollout.

**Architecture:** One pure engine `interventions.ts` (current-truth interventions + `isoWeek` + `filterUnsent` dedup). A daily cron route evaluates every connected user (reusing `loadReportContext`), dedups against a `journal_interventions` log, and emails via the existing `sendEmail` — gated to admins, skipping opt-outs (`journal_email_prefs` + a public unsubscribe route). The dashboard renders the top banner-channel intervention live.

**Tech Stack:** Next.js App Router (server components + route handlers), Supabase (service-role cron + own-row RLS), SendPulse (`@/lib/sendpulse`), Supabase pg_cron + pg_net, Vitest (TDD), TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-27-survival-engine-interventions.md`

---

## Task 1: Types

**Files:** Modify `src/lib/journal/types.ts` (append).

- [ ] **Step 1: append**

```ts
// --- Proactive interventions (Survival Engine Layer 3) ----------------------

export interface JournalInterventionRow {
  id: string;
  user_id: string;
  kind: string;
  episode_key: string;
  channel: string;
  sent_at: string;
}

export interface JournalEmailPrefsRow {
  user_id: string;
  opted_out: boolean;
  unsub_token: string;
  updated_at: string;
}
```

- [ ] **Step 2: commit** — `git add src/lib/journal/types.ts && git commit -m "feat(journal): intervention + email-pref row types"`

---

## Task 2: Engine — `interventions.ts` (pure, TDD)

**Files:** Create `src/lib/journal/interventions.ts`, `src/lib/journal/interventions.test.ts`.

- [ ] **Step 1: write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  decideInterventions,
  filterUnsent,
  isoWeek,
  type InterventionSignals,
  type SentRecord,
} from "./interventions";

const MONDAY = "2026-07-27T13:00:00.000Z"; // a Monday
const emptyLeaks = { leaks: [], strengths: [] };
const emptyRules = { score: null, cleanDays: 0, tradingDays: 0, perRule: [], breaches: [] };

function signals(over: Partial<InterventionSignals>): InterventionSignals {
  return {
    health: { status: "healthy", runwaySentence: "", factors: [] } as never,
    leaks: emptyLeaks as never,
    rules: emptyRules as never,
    lastTradeAt: "2026-07-26T10:00:00.000Z",
    hasClosedTrades: true,
    ...over,
  };
}

describe("isoWeek", () => {
  it("formats YYYY-Www", () => {
    expect(isoWeek("2026-07-27T00:00:00.000Z")).toMatch(/^2026-W\d{2}$/);
  });
  it("handles the year-end rollover (2021-01-01 is ISO 2020-W53)", () => {
    expect(isoWeek("2021-01-01T00:00:00.000Z")).toBe("2020-W53");
  });
});

describe("decideInterventions", () => {
  it("always includes a weekly_focus", () => {
    const out = decideInterventions(signals({}), MONDAY);
    expect(out.find((i) => i.kind === "weekly_focus")).toBeTruthy();
  });

  it("weekly focus leads with the #1 leak when present", () => {
    const leaks = { leaks: [{ title: "Trading after losses", detail: "18 trades.", dollarImpact: -1240 }], strengths: [] };
    const out = decideInterventions(signals({ leaks: leaks as never }), MONDAY);
    const wf = out.find((i) => i.kind === "weekly_focus")!;
    expect(wf.headline).toContain("Trading after losses");
  });

  it("weekly focus falls back to the worst broken rule", () => {
    const rules = { score: 50, cleanDays: 1, tradingDays: 2, breaches: [],
      perRule: [{ rule: "max_lots", title: "Max position size", unit: "trade", kept: 1, total: 5, breachCount: 4, enabled: true }] };
    const out = decideInterventions(signals({ rules: rules as never }), MONDAY);
    expect(out.find((i) => i.kind === "weekly_focus")!.headline).toContain("Max position size");
  });

  it("fires blowup_alert only when health is critical", () => {
    expect(decideInterventions(signals({}), MONDAY).some((i) => i.kind === "blowup_alert")).toBe(false);
    const crit = signals({ health: { status: "critical", runwaySentence: "~2 losing trades from your 10% limit", factors: [] } as never });
    const ba = decideInterventions(crit, MONDAY).find((i) => i.kind === "blowup_alert")!;
    expect(ba.severity).toBe("critical");
    expect(ba.body).toContain("~2 losing trades");
    expect(ba.channels).toContain("email");
  });

  it("fires inactivity_nudge at the 10-day boundary, email-only", () => {
    const inactive = signals({ lastTradeAt: "2026-07-10T10:00:00.000Z" }); // 17 days before MONDAY
    const iv = decideInterventions(inactive, MONDAY).find((i) => i.kind === "inactivity_nudge")!;
    expect(iv.channels).toEqual(["email"]);
    expect(iv.episodeKey).toBe("inactivity:2026-07-10");
    // just under threshold → no nudge
    const recent = signals({ lastTradeAt: "2026-07-20T10:00:00.000Z" }); // 7 days
    expect(decideInterventions(recent, MONDAY).some((i) => i.kind === "inactivity_nudge")).toBe(false);
  });
});

describe("filterUnsent", () => {
  const base = decideInterventions(
    signals({ health: { status: "critical", runwaySentence: "x", factors: [] } as never, lastTradeAt: "2026-07-01T10:00:00.000Z" }),
    MONDAY
  );

  it("drops already-logged episodes", () => {
    const wf = base.find((i) => i.kind === "weekly_focus")!;
    const log: SentRecord[] = [{ kind: "weekly_focus", episode_key: wf.episodeKey, sent_at: MONDAY }];
    const out = filterUnsent(base, log, MONDAY);
    expect(out.some((i) => i.kind === "weekly_focus")).toBe(false);
  });

  it("only sends weekly_focus on a Monday", () => {
    const tuesday = "2026-07-28T13:00:00.000Z";
    const out = filterUnsent(base, [], tuesday);
    expect(out.some((i) => i.kind === "weekly_focus")).toBe(false);
  });

  it("honours the 48h blowup cooldown", () => {
    const log: SentRecord[] = [{ kind: "blowup_alert", episode_key: "blowup:2026-07-26", sent_at: "2026-07-26T13:00:00.000Z" }];
    const out = filterUnsent(base, log, MONDAY); // 24h later
    expect(out.some((i) => i.kind === "blowup_alert")).toBe(false);
  });

  it("excludes banner-only interventions (none here are banner-only) and keeps email ones", () => {
    const out = filterUnsent(base, [], MONDAY);
    expect(out.every((i) => i.channels.includes("email"))).toBe(true);
  });
});
```

- [ ] **Step 2: run → fail** — `npx vitest run src/lib/journal/interventions.test.ts` (module missing).

- [ ] **Step 3: implement `interventions.ts`**

```ts
import type { Health } from "./health";
import type { LeakResult } from "./leaks";
import type { RulesResult } from "./rules";

// Pure intervention engine. decideInterventions returns what is CURRENTLY true;
// dedup/cadence lives in filterUnsent (send layer). `now` is passed in so the
// module stays deterministic (no Date.now()).

export type InterventionKind = "blowup_alert" | "weekly_focus" | "inactivity_nudge";

export interface InterventionSignals {
  health: Health;
  leaks: LeakResult;
  rules: RulesResult;
  lastTradeAt: string | null;
  hasClosedTrades: boolean;
}

export interface Intervention {
  kind: InterventionKind;
  severity: "critical" | "info";
  channels: ("email" | "banner")[];
  headline: string;
  body: string;
  action: string;
  episodeKey: string;
}

export interface SentRecord {
  kind: string;
  episode_key: string;
  sent_at: string;
}

export const INACTIVE_DAYS = 10;
export const BLOWUP_COOLDOWN_H = 48;
const DAY_MS = 86_400_000;

export function isoWeek(iso: string): string {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // Thursday of this week
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const fdDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fdDay + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function fmtMoney(n: number): string {
  return `${n < 0 ? "−" : "+"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pickWeeklyFocus(s: InterventionSignals): { title: string; body: string; action: string } {
  const leak = s.leaks.leaks[0];
  if (leak) {
    return {
      title: leak.title,
      body: `${leak.detail} That's your biggest bleed right now (${fmtMoney(leak.dollarImpact)}).`,
      action: "Watch for this exact pattern on every trade this week.",
    };
  }
  const worstRule = s.rules.perRule
    .filter((r) => r.enabled && !r.inert && r.breachCount > 0)
    .sort((a, b) => b.breachCount - a.breachCount)[0];
  if (worstRule) {
    return {
      title: worstRule.title,
      body: `You broke this rule ${worstRule.breachCount} time${worstRule.breachCount > 1 ? "s" : ""} recently — the one to tighten up.`,
      action: "Make respecting this rule your single measure of a good week.",
    };
  }
  return {
    title: "Build your baseline",
    body: "Nothing to flag yet — set your discipline rules so the journal can hold you to them.",
    action: "Set your rules and log how each trade felt.",
  };
}

export function decideInterventions(s: InterventionSignals, now: string): Intervention[] {
  const out: Intervention[] = [];
  const today = now.slice(0, 10);

  if (s.health.status === "critical") {
    out.push({
      kind: "blowup_alert",
      severity: "critical",
      channels: ["email", "banner"],
      headline: "Your account is close to its limit",
      body: s.health.runwaySentence,
      action: "Step your size right down or stop for the day — protect the account first.",
      episodeKey: `blowup:${today}`,
    });
  }

  const focus = pickWeeklyFocus(s);
  out.push({
    kind: "weekly_focus",
    severity: "info",
    channels: ["email", "banner"],
    headline: `This week's focus: ${focus.title}`,
    body: focus.body,
    action: focus.action,
    episodeKey: `weekly:${isoWeek(now)}`,
  });

  if (s.hasClosedTrades && s.lastTradeAt) {
    const days = Math.floor((new Date(now).getTime() - new Date(s.lastTradeAt).getTime()) / DAY_MS);
    if (days >= INACTIVE_DAYS) {
      out.push({
        kind: "inactivity_nudge",
        severity: "info",
        channels: ["email"],
        headline: "Your trading's gone quiet",
        body: `You haven't logged a trade in ${days} days. Your journal and stats are still here whenever you're ready.`,
        action: "Open your journal to pick up where you left off.",
        episodeKey: `inactivity:${s.lastTradeAt.slice(0, 10)}`,
      });
    }
  }

  return out;
}

/** Email-channel interventions that still need sending (dedup + cadence). */
export function filterUnsent(
  interventions: Intervention[],
  log: SentRecord[],
  now: string
): Intervention[] {
  const sent = new Set(log.map((r) => `${r.kind}:${r.episode_key}`));
  const isMonday = new Date(now).getUTCDay() === 1;
  const lastBlowupAt = log
    .filter((r) => r.kind === "blowup_alert")
    .map((r) => new Date(r.sent_at).getTime())
    .sort((a, b) => b - a)[0];

  return interventions.filter((iv) => {
    if (!iv.channels.includes("email")) return false;
    if (sent.has(`${iv.kind}:${iv.episodeKey}`)) return false;
    if (iv.kind === "weekly_focus" && !isMonday) return false;
    if (iv.kind === "blowup_alert" && lastBlowupAt != null) {
      const hrs = (new Date(now).getTime() - lastBlowupAt) / 3_600_000;
      if (hrs < BLOWUP_COOLDOWN_H) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: run → pass** — `npx vitest run src/lib/journal/interventions.test.ts`.
- [ ] **Step 5: commit** — `git add src/lib/journal/interventions.ts src/lib/journal/interventions.test.ts && git commit -m "feat(journal): proactive-intervention engine + dedup"`

---

## Task 3: Email HTML builder (pure, TDD)

**Files:** Create `src/lib/journal/interventionEmail.ts`, `src/lib/journal/interventionEmail.test.ts`.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest";
import { interventionEmailHtml } from "./interventionEmail";

describe("interventionEmailHtml", () => {
  it("includes the headline, action, CTA and unsubscribe links", () => {
    const html = interventionEmailHtml({
      headline: "This week's focus: Trading after losses",
      body: "18 trades after 2+ losses.",
      action: "Watch for this pattern.",
      ctaUrl: "https://app.marketmakersfx.net/journal",
      unsubUrl: "https://app.marketmakersfx.net/api/journal/email/unsubscribe?token=abc",
    });
    expect(html).toContain("This week's focus: Trading after losses");
    expect(html).toContain("Watch for this pattern.");
    expect(html).toContain("https://app.marketmakersfx.net/journal");
    expect(html).toContain("unsubscribe?token=abc");
    expect(html).toContain("<html");
  });
});
```

- [ ] **Step 2: run → fail** — `npx vitest run src/lib/journal/interventionEmail.test.ts`.

- [ ] **Step 3: implement** (inline-styled, email-client-safe; escape interpolated text)

```ts
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function interventionEmailHtml(p: {
  headline: string;
  body: string;
  action: string;
  ctaUrl: string;
  unsubUrl: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef1">
        <tr><td style="background:#0a0a0a;padding:18px 28px">
          <span style="color:#ff5a1f;font-weight:700;font-size:15px;letter-spacing:.3px">MARKET MAKERS FX</span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(p.headline)}</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a3a">${esc(p.body)}</p>
          <div style="margin:0 0 22px;padding:14px 16px;background:#fff4ef;border-left:3px solid #ff5a1f;border-radius:8px;font-size:14px;line-height:1.5">
            <strong>Do this:</strong> ${esc(p.action)}
          </div>
          <a href="${esc(p.ctaUrl)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">Open your journal</a>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eceef1;font-size:12px;color:#8a8f98">
          You're getting this because you track your trading with Market Makers FX.
          <a href="${esc(p.unsubUrl)}" style="color:#8a8f98">Unsubscribe</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
```

- [ ] **Step 4: run → pass** — `npx vitest run src/lib/journal/interventionEmail.test.ts`.
- [ ] **Step 5: commit** — `git add src/lib/journal/interventionEmail.ts src/lib/journal/interventionEmail.test.ts && git commit -m "feat(journal): intervention email template"`

---

## Task 4: Migration — `journal_interventions` + `journal_email_prefs`

**Files:** Create `supabase/migrations/20260727000001_journal_interventions.sql`, `scripts/apply-journal-interventions-migration.mjs`.

- [ ] **Step 1: migration SQL**

```sql
-- Layer 3: intervention send-log (dedup) + per-user email prefs (opt-out).
create table if not exists public.journal_interventions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  episode_key text not null,
  channel     text not null,
  sent_at     timestamptz not null default now()
);
create index if not exists journal_interventions_user_idx
  on public.journal_interventions (user_id, kind, sent_at desc);
alter table public.journal_interventions enable row level security;
drop policy if exists "journal_interventions_select_own" on public.journal_interventions;
create policy "journal_interventions_select_own"
  on public.journal_interventions for select
  to authenticated using (user_id = auth.uid());

create table if not exists public.journal_email_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  opted_out   boolean not null default false,
  unsub_token text not null unique default gen_random_uuid()::text,
  updated_at  timestamptz not null default now()
);
alter table public.journal_email_prefs enable row level security;
drop policy if exists "journal_email_prefs_all_own" on public.journal_email_prefs;
create policy "journal_email_prefs_all_own"
  on public.journal_email_prefs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 2: apply script** — copy `scripts/apply-journal-rules-migration.mjs`, change the migration filename to `20260727000001_journal_interventions.sql`, and change the final query to `select count(*) from public.journal_interventions`.

- [ ] **Step 3: apply** — `node scripts/apply-journal-interventions-migration.mjs` → prints `0` + "applied".
- [ ] **Step 4: commit** — `git add supabase/migrations/20260727000001_journal_interventions.sql scripts/apply-journal-interventions-migration.mjs && git commit -m "feat(journal): intervention log + email-prefs tables"`

---

## Task 5: Unsubscribe route (public, tokenized)

**Files:** Create `src/app/api/journal/email/unsubscribe/route.ts`.

- [ ] **Step 1: write it**

```ts
import { NextRequest } from "next/server";
import { serviceClient } from "@/lib/journal/api";

// Public, no auth — the opaque token IS the capability. Always returns the same
// page so an unknown token reveals nothing (no enumeration).
const PAGE = (msg: string) =>
  new Response(
    `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#f6f7f9;margin:0">
      <div style="max-width:440px;margin:80px auto;background:#fff;border:1px solid #eceef1;border-radius:16px;padding:32px;text-align:center">
        <h1 style="font-size:20px;margin:0 0 10px">${msg}</h1>
        <p style="color:#6a6f78;font-size:14px;margin:0">You can re-enable emails anytime from your journal settings.</p>
      </div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    const db = serviceClient();
    await db.from("journal_email_prefs").update({ opted_out: true, updated_at: new Date().toISOString() }).eq("unsub_token", token);
  }
  return PAGE("You've been unsubscribed");
}
```

- [ ] **Step 2: typecheck** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 3: commit** — `git add src/app/api/journal/email/unsubscribe/route.ts && git commit -m "feat(journal): tokenized email unsubscribe route"`

---

## Task 6: Cron route — evaluate + email

**Files:** Create `src/app/api/journal/cron/interventions/route.ts`. Confirm `serviceClient` + the cron-auth pattern by reading `src/app/api/journal/cron/sync/route.ts` first.

- [ ] **Step 1: write it**

```ts
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { loadReportContext } from "@/lib/journal/coach";
import {
  decideInterventions,
  filterUnsent,
  type InterventionSignals,
  type SentRecord,
} from "@/lib/journal/interventions";
import { interventionEmailHtml } from "@/lib/journal/interventionEmail";
import { sendEmail } from "@/lib/sendpulse";

export const maxDuration = 300;

const FROM = { name: "Market Makers FX", email: "hello@marketmakersfx.net" };
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.marketmakersfx.net";

function authorized(req: NextRequest): boolean {
  const secret = process.env.JOURNAL_CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date().toISOString();
  const db = serviceClient();

  // Distinct users with a connected journal account.
  const { data: accts } = await db.from("journal_accounts").select("user_id").neq("state", "disconnected");
  const userIds = [...new Set((accts ?? []).map((a) => a.user_id as string))];

  let evaluated = 0;
  let sent = 0;

  for (const userId of userIds) {
    try {
      const ctx = await loadReportContext(db, userId);
      if (!ctx || !ctx.health || !ctx.leaks || !ctx.rules) continue;
      evaluated += 1;

      const closed = ctx.sampleTrades.filter((t) => t.status === "closed" && t.close_time);
      const lastTradeAt = closed.reduce<string | null>(
        (max, t) => (max == null || (t.close_time as string) > max ? (t.close_time as string) : max),
        null
      );
      const signals: InterventionSignals = {
        health: ctx.health,
        leaks: ctx.leaks,
        rules: ctx.rules,
        lastTradeAt,
        hasClosedTrades: closed.length > 0,
      };

      const { data: logRows } = await db
        .from("journal_interventions")
        .select("kind, episode_key, sent_at")
        .eq("user_id", userId);
      const toSend = filterUnsent(decideInterventions(signals, now), (logRows ?? []) as SentRecord[], now);
      if (!toSend.length) continue;

      // Rollout gate: admins only, and skip opt-outs.
      const { data: profile } = await db
        .from("profiles")
        .select("email, full_name, is_admin")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.is_admin || !profile.email) continue;

      const { data: prefs } = await db
        .from("journal_email_prefs")
        .upsert({ user_id: userId, updated_at: now }, { onConflict: "user_id" })
        .select("opted_out, unsub_token")
        .single();
      if (!prefs || prefs.opted_out) continue;

      const unsubUrl = `${APP_URL}/api/journal/email/unsubscribe?token=${prefs.unsub_token}`;
      const ctaUrl = `${APP_URL}/journal`;

      for (const iv of toSend) {
        const html = interventionEmailHtml({
          headline: iv.headline,
          body: iv.body,
          action: iv.action,
          ctaUrl,
          unsubUrl,
        });
        const res = await sendEmail({
          to: { name: profile.full_name || profile.email, email: profile.email },
          from: FROM,
          subject: iv.headline,
          html,
        });
        if (res.ok) {
          await db.from("journal_interventions").insert({
            user_id: userId,
            kind: iv.kind,
            episode_key: iv.episodeKey,
            channel: "email",
            sent_at: new Date().toISOString(),
          });
          sent += 1;
        }
      }
    } catch {
      // best-effort: one user's failure never blocks the rest
    }
  }

  return NextResponse.json({ ok: true, evaluated, sent, users: userIds.length });
}
```

- [ ] **Step 2: typecheck** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 3: commit** — `git add src/app/api/journal/cron/interventions/route.ts && git commit -m "feat(journal): daily intervention cron — dedup + admin-gated email"`

---

## Task 7: In-app banner + page wiring

**Files:** Create `src/app/journal/InterventionBanner.tsx`; modify `src/app/journal/page.tsx`, `src/app/journal/JournalDashboard.tsx`.

- [ ] **Step 1: `InterventionBanner.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Intervention } from "@/lib/journal/interventions";

// Shows the single most-severe banner-channel intervention. Interventions are
// decided server-side (deterministic `now`) and passed in.
export function InterventionBanner({ interventions }: { interventions: Intervention[] }) {
  const [dismissed, setDismissed] = useState(false);
  const banner = interventions
    .filter((i) => i.channels.includes("banner"))
    .sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1))[0];
  if (!banner || dismissed) return null;

  const critical = banner.severity === "critical";
  return (
    <div
      className={`rise mb-6 flex items-start gap-3 rounded-2xl border p-4 shadow-soft ${
        critical ? "border-red-300 bg-red-50" : "border-orange/30 bg-accent-soft/40"
      }`}
    >
      <span className={`mt-0.5 text-lg ${critical ? "text-red-600" : "text-orange"}`}>
        {critical ? "⚠" : "✦"}
      </span>
      <div className="flex-1">
        <p className={`text-[15px] font-bold ${critical ? "text-red-800" : "text-ink"}`}>
          {banner.headline}
        </p>
        {banner.body && <p className="mt-0.5 text-[13px] text-ink/80">{banner.body}</p>}
        <p className="mt-1 text-[13px] font-semibold text-ink">
          → {banner.action}{" "}
          <Link href="/journal#discipline" className="text-accent-ink underline">
            Review
          </Link>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg px-2 py-1 text-[13px] text-subtle hover:text-ink"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `page.tsx`** — add `import { decideInterventions, type InterventionSignals } from "@/lib/journal/interventions";`. After `rules` is computed, add:

```ts
  const closedAll = allTrades.filter((t) => t.status === "closed" && t.close_time);
  const lastTradeAt = closedAll.reduce<string | null>(
    (max, t) => (max == null || (t.close_time as string) > max ? (t.close_time as string) : max),
    null
  );
  const interventionSignals: InterventionSignals = {
    health,
    leaks,
    rules,
    lastTradeAt,
    hasClosedTrades: closedAll.length > 0,
  };
  const interventions = decideInterventions(interventionSignals, new Date().toISOString());
```

Then pass `interventions={interventions}` to `<JournalDashboard>`.

- [ ] **Step 3: `JournalDashboard.tsx`** — add `import { InterventionBanner } from "./InterventionBanner";` and `import type { Intervention } from "@/lib/journal/interventions";`. Add `interventions: Intervention[]` to the props type + destructure. Render the banner as the first child inside the outer `<div className="mx-auto max-w-5xl …">`, immediately before the `<div className="rise">` header block:

```tsx
      <InterventionBanner interventions={interventions} />
```

- [ ] **Step 4: typecheck + build** — `npx tsc --noEmit && npm run build` → exit 0.
- [ ] **Step 5: commit** — `git add src/app/journal/InterventionBanner.tsx src/app/journal/page.tsx src/app/journal/JournalDashboard.tsx && git commit -m "feat(journal): in-app intervention banner"`

---

## Task 8: Verify, live smoke, push, schedule cron

- [ ] **Step 1: full suite** — `npx vitest run && npx tsc --noEmit && npm run build` → all pass.

- [ ] **Step 2: live smoke** (temp script, like L2 — evaluate the real connected user without sending). Create `scripts/smoke-interventions.mjs` that connects via the pooler, loads the most recent 1000 closed trades, builds minimal signals from raw rows via `evaluateRules`/`detectLeaks`/`accountHealth` (import the `.ts` under `npx tsx`), runs `decideInterventions` + `filterUnsent` against `select kind, episode_key, sent_at from journal_interventions`, and logs the would-send list. Run `npx tsx scripts/smoke-interventions.mjs`, confirm sensible output, then `rm scripts/smoke-interventions.mjs`.

- [ ] **Step 3: push** — `git push origin main` (deploys the cron route to Vercel).

- [ ] **Step 4: schedule the daily cron** — create `scripts/schedule-interventions-cron.mjs` that clones the existing `journal-sync` job so the secret never leaves the DB:

```js
import { readFileSync } from "node:fs";
import pg from "pg";
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
const client = new pg.Client({ host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432, user: "postgres.dldrcitoeoxzfctsqlmo", password, database: "postgres", ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query("select command from cron.job where jobname = 'journal-sync'");
if (!rows.length) throw new Error("journal-sync job not found — cannot clone secret");
const syncCmd = rows[0].command;
if (!syncCmd.includes("/api/journal/cron/sync")) throw new Error("unexpected journal-sync command shape");
const cmd = syncCmd.replaceAll("/api/journal/cron/sync", "/api/journal/cron/interventions");
await client.query("select cron.unschedule('journal-interventions') where exists (select 1 from cron.job where jobname = 'journal-interventions')");
await client.query("select cron.schedule('journal-interventions', '0 13 * * *', $1)", [cmd]);
const { rows: j } = await client.query("select jobname, schedule, active from cron.job where jobname = 'journal-interventions'");
await client.end();
console.log("scheduled:", j); // prints jobname/schedule/active only — never the command/secret
```

Run `node scripts/schedule-interventions-cron.mjs` → prints the job active at `0 13 * * *`. Commit the script: `git add scripts/schedule-interventions-cron.mjs && git commit -m "chore(journal): schedule daily intervention cron" && git push`.

- [ ] **Step 5: end-to-end email check** — with the job scheduled (admin-only gate means only Gordon's account can receive), trigger one real run to confirm delivery: from the repo, `TOKEN=$(grep '^JOURNAL_CRON_SECRET' .env.local | cut -d= -f2); curl -s -X POST -H "Authorization: Bearer $TOKEN" https://app.marketmakersfx.net/api/journal/cron/interventions` → JSON `{ ok, evaluated, sent, users }`. If `sent > 0`, confirm the email arrived; the log row prevents a duplicate on the next run. (Never echo `$TOKEN`.)

---

## Deferred (spec §Rollout-phase)

Flip the admin-only gate to all users (keep opt-out); add an in-app email-prefs toggle; consider discipline-slip + win-reinforcement moments; tune `INACTIVE_DAYS`/`BLOWUP_COOLDOWN_H`/send hour on real data.
