# MMFX Trading Journal — Launch Plan

_Last updated 2026-08-13. Owner: Gordon._

## 0. Where we are

The journal is **feature-complete and fully hardened**, running on `app.marketmakersfx.net` but **admin-only** (nav in `ADMIN_NAV`, pages redirect non-admins, API routes use `requireAdminApi`). Everything from the stress test, redesign and correctness passes is closed:

- Security (RLS write-lockdown), billing (reaper/undeploy, wrong-password escalation, batch cap), trust (the $5-trap), all cost items ✓
- Full UI redesign — account strip, two-column, equity hero, KPI deltas, trader radar, sorted bars, "Don's read", first-run state ✓
- All analytics correctness (scoping, drawdown %, sessions, day bucketing, dedup, win-rate/PF edges) ✓
- 217 unit tests + a 4,000-dataset fuzz, green.

**One code change — the guard flip — stands between admin-only and live.** Everything else below is process.

---

## 1. Decisions to make first (these shape the build)

1. **Who gets it — members only, or trials too?**
   Every connected account costs MetaApi ~$1.25–2.50/mo. Letting free trials connect = paying to sync non-payers.
   - **Recommended: `member_active` only at launch.** Positions the journal as a premium member benefit and keeps cost tied to revenue. Open to trials later as an acquisition hook if it converts.
2. **Staged or big-bang?**
   - **Recommended: soft-launch** to ~10–20 engaged members for 3–5 days (validate real-world connect success + MetaApi cost + zero errors at scale), then open to all members.
3. **MetaApi budget + alert.** Set a funded balance with headroom and a low-balance alert. Decide the monthly ceiling and who gets paged.

---

## 2. Pre-flight checklist (before flipping the switch)

**Technical**
- [ ] MetaApi account funded with headroom; **low-balance alert** configured (this is now a recurring dependency).
- [ ] Nightly sync cron confirmed clean (`failed: 0`, no stuck `running` jobs, no accounts left deployed) for 2–3 nights.
- [ ] `ANTHROPIC_API_KEY` live (coach) and SendPulse sender `hello@marketmakersfx.net` verified (intervention emails).
- [ ] Guard-flip diff prepared on a branch and tested (a non-admin member can reach `/journal` and connect; IB pages still blocked).

**Product / legal**
- [ ] Connect screen consent copy is clear: read-only **investor** password, never stored, we can't trade or withdraw.
- [ ] Tier gating (Decision 1) reflected in the guards + nav.

**Comms**
- [ ] Telegram announcement + 3:4 image drafted.
- [ ] Member email drafted ("Your Trading Journal is live") + a short "how to connect your MT5" step-by-step.

---

## 3. Go-live: the exact technical steps (the guard flip)

1. Flip `requireAdminApi → requireFullApi` (or a `member_active` guard per Decision 1) on: `accounts` (POST/DELETE/sync), `goals`, `rules`, `trades/[id]`, `report/generate`.
2. **KEEP admin-only** (these expose *other members'* data): `ib/import`, `ib/report`, `ib/member-report`, `accounts/[id]/ib-action`, and the `journal/ib` page.
3. Drop the `is_admin` redirect on `journal/page.tsx` and `journal/connect/page.tsx` (keep it on `journal/ib/page.tsx`).
4. Remove the `is_admin` gate inside `cron/interventions/route.ts` (otherwise members get no intervention emails).
5. Move the "Trading Journal" nav item from `ADMIN_NAV` → `NAV`, tier-gated. (Leave "IB Reconciliation" in `ADMIN_NAV`.)
6. Build → test → deploy. **Verify** a real non-admin member can open `/journal`, connect an MT5 account, and cannot reach `/journal/ib`.

_(The precise route list is mirrored in the `mmfx-journal-prepublish` memory. `requireFullApi` already exists in `lib/journal/api.ts`.)_

---

## 4. Staged rollout

- **Phase 1 — soft (day 0–4):** enable for a small cohort (allowlist, or announce only to those members). Watch the metrics in §5.
- **Phase 2 — full (day ~5):** announce to all members (Telegram + email).
- **Phase 3 — acquisition (later, optional):** open to trials as a hook if the numbers justify the MetaApi spend.

---

## 5. Monitoring (first 2 weeks intensively, then ongoing)

- **MetaApi:** balance trend, deploy failures, connect success rate, cost/account.
- **Sync cron:** nightly `failed` = 0; no orphaned `running` jobs; no accounts left deployed (the reaper + undeploy safeguards behaving).
- **Wrong-password escalation:** accounts hitting the terminal "reconnect needed" state (a proxy for connect UX problems).
- **Coach:** Anthropic spend, report volume, error rate (the atomic quota holding).
- **App:** journal route error rate, connect-flow drop-off.

---

## 6. Rollback

The journal is **additive** — nothing else depends on it. If anything goes wrong: **revert the guard-flip commit → back to admin-only in one deploy.** Members' connected accounts persist (undeployed, not billing). No data loss, no impact on any other feature.

---

## 7. Cost model

- **MetaApi:** ~$1.25–2.50/account/mo (deploy-on-demand). At 100 connected members ≈ **$125–250/mo**.
- **Anthropic:** ~$0.005/report, capped at 5/member/day. Negligible at launch scale.
- Fund MetaApi with buffer and set the low-balance alert **before** Phase 1.

---

## 8. Comms plan

- **Telegram:** announcement post + 3:4 image (same playbook as the auth-migration launch).
- **Email:** "Your Trading Journal is live" + connect steps (read-only investor password, syncs automatically).
- **In-app:** a "New" badge / "Start here" nudge on the nav or dashboard.

---

## 9. Success metrics

- % of eligible members who connect an account (set a target).
- Sync success rate > 95%.
- Coach generations / week; journal WAU; retention/engagement lift vs non-users.

---

### Not blockers (separate tracks)
Broader app launch items (custom domain, Softr user migration, security rotations) are independent — the app is already live, so the journal launch doesn't depend on them.
