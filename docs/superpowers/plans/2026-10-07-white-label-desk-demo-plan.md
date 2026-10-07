# Plan: white-label brand layer + Summit Desk demo

Spec: `docs/superpowers/specs/2026-10-07-white-label-desk-demo-design.md`

1. **brand.ts** — module + tests (defaults equal today's literals; env overrides parse; wordmark split; featuresOff parse).
2. **Refactor literals → BRAND** across ~65 non-test source files in three disjoint groups (libs: email/deposit/journal/fundamental; libs: support/channel/organic/growth/guides/tv/health + API routes; app pages/components/legal). Tests must stay green with no test edits except where a test hard-codes a literal the code now derives.
3. **Theme + layout** — inline accent vars on `<html>`, metadata title from BRAND, demo banner in AppShell.
4. **Feature toggles** — nav filter + `requireFeature` redirect for `featuresOff`.
5. **Pitch page** — `/` renders partner pitch when `BRAND.demo`.
6. **Cron hygiene** — tv-sync / sendpulse-sync skip when creds absent.
7. **migrate-fresh.mjs** — apply all migrations to a DB URL; run against the demo project; fix forward anything that assumes production state.
8. **Seeds** — generalise demo-user / seed-journal-demo to take a DB URL; add demo admin, sample analyses, live classes, growth rows.
9. **Deploy** — worktree → `vercel link` new project → env → `vercel --prod`; verify in browser.
10. **PR** to main; hand-off list for Gordon.
