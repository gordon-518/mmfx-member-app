# Standing up a white-label tenant

One codebase, one deployment per tenant. A tenant is a Supabase project plus a
Vercel project pointed at this repo, differing only in environment variables.
Spec: `docs/superpowers/specs/2026-10-07-white-label-desk-demo-design.md`.

The first tenant is the demo, **Summit Desk** (`.env.demo.local`, git-ignored).

## 1. Database

```bash
# Create the project (Sydney, next to the others). Keep the password.
npx supabase projects create <tenant-slug> --org-id fgneepsoibyxlrbquywe \
  --db-password '<generated>' --region ap-southeast-2

# Apply every migration. New projects sit on the aws-0 pooler.
npx supabase db push --db-url \
  'postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'

# Auth: site URL + redirect allow list (Management API; token is SUPABASE_ACCESS_TOKEN in .env.local).
curl -X PATCH https://api.supabase.com/v1/projects/<ref>/config/auth \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"site_url":"https://<app-domain>","uri_allow_list":"https://<app-domain>/**"}'
```

Write `.env.<tenant>.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (`npx supabase projects api-keys --project-ref <ref>`),
`DATABASE_URL`, `DB_POOLER_HOST=aws-0-ap-southeast-2.pooler.supabase.com`,
`DB_POOLER_USER=postgres.<ref>`, then the brand block below.

## 2. Brand

| Env var | Meaning | Example (demo) |
|---|---|---|
| `NEXT_PUBLIC_BRAND_NAME` | Full name | Summit Desk |
| `NEXT_PUBLIC_BRAND_SHORT` | Short form | Summit |
| `NEXT_PUBLIC_BRAND_WORDMARK` | `lead\|accent` | Summit\|Desk |
| `NEXT_PUBLIC_BRAND_DOMAIN` | Bare domain | summitdesk.example |
| `NEXT_PUBLIC_APP_URL` | Where the desk is served | https://ib-demo-desk.vercel.app |
| `NEXT_PUBLIC_BRAND_SUPPORT_EMAIL` | Support address | hello@summitdesk.example |
| `NEXT_PUBLIC_BRAND_POSTAL` | Email postal line | Summit Desk, Singapore |
| `NEXT_PUBLIC_BRAND_PERSONA` | First-person voice | the desk |
| `NEXT_PUBLIC_BRAND_TOP_TIER` | Name of the top tier | Team MM |
| `NEXT_PUBLIC_BRAND_ACCENT` / `_SOFT` / `_INK` | Accent trio | #0d9488 / #ccfbf1 / #0f766e |
| `NEXT_PUBLIC_BRAND_FEATURES_OFF` | Hidden surfaces (feature keys) | library,signals,team-mm |
| `NEXT_PUBLIC_BRAND_DEMO` | Demo banner + pitch page at `/` | true |
| `NEXT_PUBLIC_IB_NUMBER`, `NEXT_PUBLIC_DUPOIN_SIGNUP`, `NEXT_PUBLIC_SUPPORT_BOT_LINK` | The IB's own broker links | |
| `NEXT_PUBLIC_FUNDAMENTAL_BOT_URL`, `NEXT_PUBLIC_KYS_BOT_URL` | Bot hosts (default: MMFX's) | |

Unset vars fall back to Market Makers FX, so production needs none of them.

Secrets every tenant needs: `CRON_SECRET`, `JOURNAL_CRON_SECRET`, `CHANNEL_CRON_SECRET`,
`ORGANIC_CRON_SECRET`, `SHOWCASE_TOKEN`, `SHOWCASE_DEMO_EMAIL`, `FOREXNEWSAPI_TOKEN`,
`ANTHROPIC_API_KEY`, `METAAPI_TOKEN`. Optional and off by default: SendPulse, Telegram,
TradingView (`TV_USERNAME`/`TV_PASSWORD`), `EMAIL_LIFECYCLE_ENABLED`, `SUPPORT_AGENT_ENABLED`.
Crons that lack their credentials return 200 "skipped".

## 3. Seed

```bash
node scripts/demo-user.mjs --env .env.<tenant>.local setup member_active   # showcase member
node scripts/seed-journal-demo.mjs --env .env.<tenant>.local <member-email>  # 90 days of trades
node scripts/seed-demo-desk.mjs --env .env.<tenant>.local --analyses-from .env.local
```

`seed-demo-desk.mjs` needs `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` in the env file and
creates the back-office admin, copies three recent analyses from the source tenant as
sample content, two live classes, and thirty days of growth snapshots.

## 4. Hosting

```bash
git worktree add --detach ../<tenant-dir> <branch>
cd ../<tenant-dir>
npx vercel project add <tenant-slug>
npx vercel link --yes --project <tenant-slug>
# Framework preset is NOT auto-set when the project is created from the CLI; without it
# every route 404s. Also drop the team's default SSO protection so prospects can view it.
curl -X PATCH "https://api.vercel.com/v9/projects/<projectId>?teamId=team_QyqQQdF00KHaGKW4r7eYzTx1" \
  -H "Authorization: Bearer <vercel-token>" -H 'Content-Type: application/json' \
  -d '{"framework":"nextjs","ssoProtection":null,"passwordProtection":null}'
# env: `npx vercel env add NAME production --value '...' --yes` for each var above
#      (the anon key needs `--type config`; it is public by design)
npx vercel --prod --yes
```

Custom domain: `npx vercel domains add <domain> <tenant-slug>`, then update
`NEXT_PUBLIC_APP_URL`, `APP_URL`, the Supabase auth site URL, and redeploy.

## What does not white-label yet

- TradingView scripts carry the MMFX author name (neutral engine brand pending).
- The Fundamental Desk and Know Your Style bots are MMFX-hosted and branded inside.
- Email assets (`mark@2x.png`) are served from marketmakersfx.net.
- The US/UK lifetime plans are MMFX products ("Team MM Access").
- Google sign-in needs a Google OAuth app per Supabase project.
- Course videos and eBooks are MMFX content; hide those surfaces or supply the tenant's own.
