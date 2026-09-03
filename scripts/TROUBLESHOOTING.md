# MM App — Troubleshooting scripts

Read-only support tools for diagnosing member issues in production. All read the
Supabase pooler password from `.env.local` (`DATABASE_URL`) and connect via the
IPv4 pooler (`aws-1-ap-southeast-2.pooler.supabase.com:5432`) — the direct host is
IPv6-only. None of these write data; they're for diagnosis only.

## Scripts

| Script | Usage | What it shows |
|---|---|---|
| `check-user.mjs` | `node scripts/check-user.mjs <email>` | Profile: account_status, trial dates, `tradingview_username`, last sign-in |
| `check-tv-access.mjs` | `node scripts/check-tv-access.mjs <tvUsername>` | Whether a TradingView username is actually granted each of the 12 MM invite-only scripts (uses the stored `tv_session` cookie) |
| `check-journal-account.mjs` | `node scripts/check-journal-account.mjs <mt5_login>` | `journal_accounts` row(s) for that MT5 login: state, `state_detail` (the real MetaApi error), `metaapi_account_id`, IB review |

## Common playbooks

**"Indicators are locked in TradingView"** → `check-user.mjs <email>` to confirm
`member_active` + read their `tradingview_username`, then `check-tv-access.mjs
<username>`. If all 12 show granted, the lock icon is just the normal invite-only
marker — they likely have access or are on a different TV account.

**Journal "Connection failed — please try again"** → usually a MetaApi orphan from
the 15s provisioning timeout (account created + billing, DB row says `failed`).
Run `check-journal-account.mjs <login>`, read `state_detail`, then list MetaApi
accounts by login and adopt the orphan back. Full procedure in memory
`mmfx-journal-metaapi-orphans`. Correct Dupoin server name = `DupoinMarkets-Real`.
