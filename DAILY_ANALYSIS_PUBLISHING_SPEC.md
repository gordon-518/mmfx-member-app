# MMFX — Daily Analysis Auto-Publishing Spec

**Purpose:** how to programmatically publish a daily analysis into the Market Makers FX member app, so it appears on `app.marketmakersfx.net/daily-analysis` with **zero manual posting**. This is the "push it into the app" half — it assumes the assets (PDF, Gumlet video, thumbnail, description, bias) are already produced per the analysis-creation workflow.

> **Phase 1 scope:** a human pastes the day's screenshots + analysis text into the building chat → the tool generates the assets → then runs the publish step in this doc. Phase 2 can fully automate the front end.

---

## 1. What "publishing" actually does

For one trading day, three things happen against Supabase:

1. **Upload the cover image** → public storage bucket `analysis-covers` at path `cover-<DATE>.png`
2. **Upload the report PDF** → private storage bucket `analysis-reports` at path `report-<DATE>.pdf`
3. **Insert one row** into the `public.daily_analysis` table referencing those paths + the Gumlet video id

That's it. The app reads the table **live on every request**, so the entry appears instantly — **no deploy, no rebuild**.

---

## 2. Inputs (per day)

| Input | Example | Source |
|---|---|---|
| Date | `2026-06-24` | the trading day (UTC date) |
| Title | `⚜️ XAUUSD Daily Analysis — 24 June 2026` | fixed format (see §5) |
| Description | short plain-text summary | the Telegram "Daily Analysis" post, stripped of markdown |
| Bias | `bearish` \| `bullish` \| `neutral` | from the analysis (lowercase) |
| Session | `London` | constant |
| Gumlet embed URL | `https://play.gumlet.io/embed/6a3b6ec8fc209e32276f7411` | the uploaded video |
| Cover PNG file | `MMFX_Thumbnail_2026-06-24.png` | generated thumbnail |
| Report PDF file | `MMFX_XAUUSD_Analysis_2026-06-24.pdf` | generated PDF |

---

## 3. Supabase target

| | |
|---|---|
| Project ref | `dldrcitoeoxzfctsqlmo` |
| Project URL | `https://dldrcitoeoxzfctsqlmo.supabase.co` |
| REST (PostgREST) base | `https://dldrcitoeoxzfctsqlmo.supabase.co/rest/v1` |
| Storage base | `https://dldrcitoeoxzfctsqlmo.supabase.co/storage/v1/object` |
| Cover bucket | **`analysis-covers`** — public |
| Report bucket | **`analysis-reports`** — private (served to members via the app's `/api/reports/[id]`) |
| Table | **`public.daily_analysis`** |

### Credentials — use the **service_role** key
Writing rows + uploading to storage requires the Supabase **service_role** key (bypasses RLS). Keep it **server-side / in an env var only — never in client code or committed files.**

Two ways to obtain it:
- **Env var (preferred):** set `SUPABASE_SERVICE_ROLE_KEY` in the automation tool's environment.
- **Via Management API** (if the tool already holds a Supabase personal access token `SUPABASE_ACCESS_TOKEN`):
  ```
  GET https://api.supabase.com/v1/projects/dldrcitoeoxzfctsqlmo/api-keys?reveal=true
  Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
  → find the entry where name === "service_role", use its api_key
  ```

---

## 4. The `daily_analysis` table (exact schema)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | auto | default `gen_random_uuid()` — **do not set** |
| `published_on` | date | ✅ | `YYYY-MM-DD`. The sort/group key. **Must be unique per day** (see idempotency, §7) |
| `title` | text | ✅ | see format §5 |
| `gumlet_id` | text | ✅ | **the id only**, not the full URL (see §5) |
| `description` | text | optional | plain text, no markdown/HTML |
| `bias` | text | optional | exactly `bullish` \| `bearish` \| `neutral` (**lowercase**) |
| `session_tag` | text | optional | `London` |
| `is_published` | boolean | ✅ | set `true` (the page only shows published rows) |
| `cover_path` | text | optional | bucket path only, e.g. `cover-2026-06-24.png` |
| `report_path` | text | optional | bucket path only, e.g. `report-2026-06-24.pdf` |
| `created_at` | timestamptz | auto | default `now()` — **do not set** |

### Critical format rules (these are easy to get wrong)
- **`bias` must be lowercase** (`bearish`, not `Bearish`) — the page filters on the lowercase value.
- **`gumlet_id` is just the hash.** From `https://play.gumlet.io/embed/6a3b6ec8fc209e32276f7411` → store `6a3b6ec8fc209e32276f7411`. Extract by taking the path segment after `/embed/` and dropping any `?`/`#`.
- **`cover_path` / `report_path` are storage paths, NOT URLs.** Store `cover-2026-06-24.png`, never a full `https://...` link. The app builds the URL from the path.
- **Naming convention is load-bearing:** `cover-<DATE>.png` and `report-<DATE>.pdf` where `<DATE>` = `published_on`. Keep it consistent.
- **`title` emoji:** the ⚜️ prefix is part of the house style — keep it.

---

## 5. Title format

```
⚜️ XAUUSD Daily Analysis — <D> <Month> <YYYY>
```
- `<D>` = day of month, no leading zero (e.g. `24`, `1`)
- `<Month>` = full month name (`June`)
- Example: `⚜️ XAUUSD Daily Analysis — 24 June 2026`

---

## 6. Storage upload + row insert (the API calls)

**Headers used everywhere:** `Authorization: Bearer <service_role>` (and `apikey: <service_role>` for the REST insert).

### 6a. Upload cover (public bucket)
```
POST https://dldrcitoeoxzfctsqlmo.supabase.co/storage/v1/object/analysis-covers/cover-<DATE>.png
Authorization: Bearer <service_role>
Content-Type: image/png
x-upsert: true
<binary PNG body>
```

### 6b. Upload report (private bucket)
```
POST https://dldrcitoeoxzfctsqlmo.supabase.co/storage/v1/object/analysis-reports/report-<DATE>.pdf
Authorization: Bearer <service_role>
Content-Type: application/pdf
x-upsert: true
<binary PDF body>
```

### 6c. Insert the row
```
POST https://dldrcitoeoxzfctsqlmo.supabase.co/rest/v1/daily_analysis
apikey: <service_role>
Authorization: Bearer <service_role>
Content-Type: application/json
Prefer: return=minimal

{
  "published_on": "2026-06-24",
  "title": "⚜️ XAUUSD Daily Analysis — 24 June 2026",
  "gumlet_id": "6a3b6ec8fc209e32276f7411",
  "description": "Daily bear day 3 ...",
  "bias": "bearish",
  "session_tag": "London",
  "is_published": true,
  "cover_path": "cover-2026-06-24.png",
  "report_path": "report-2026-06-24.pdf"
}
```

---

## 7. Idempotency (don't double-post)

Before inserting, check whether the date already exists:
```
GET https://dldrcitoeoxzfctsqlmo.supabase.co/rest/v1/daily_analysis?select=published_on&published_on=eq.<DATE>
apikey: <service_role>   Authorization: Bearer <service_role>
```
If it returns a row, **skip the insert** (uploads can still `x-upsert` safely to replace assets). This makes re-runs safe.

---

## 8. Complete reference script (Node.js, runnable)

Drop-in for publishing **one** day. Needs Node 18+ (global `fetch`). Provide the service key via env.

```js
import fs from "node:fs";

// ---- config ----
const REF = "dldrcitoeoxzfctsqlmo";
const PROJ = `https://${REF}.supabase.co`;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;   // never hardcode
if (!SERVICE) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY");

// ---- the day's inputs ----
const entry = {
  date: "2026-06-24",
  title: "⚜️ XAUUSD Daily Analysis — 24 June 2026",
  description: "Daily bear day 3, Daily Low 4,025 = only liquidity left; ...",
  bias: "bearish",                 // bullish | bearish | neutral (lowercase)
  session: "London",
  embedUrl: "https://play.gumlet.io/embed/6a3b6ec8fc209e32276f7411",
  coverFile: "/path/to/MMFX_Thumbnail_2026-06-24.png",
  reportFile: "/path/to/MMFX_XAUUSD_Analysis_2026-06-24.pdf",
};

const gumletId = entry.embedUrl.split("/embed/").pop().split(/[?#]/)[0].trim();
const coverPath = `cover-${entry.date}.png`;
const reportPath = `report-${entry.date}.pdf`;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

// idempotency
const exists = await (await fetch(
  `${PROJ}/rest/v1/daily_analysis?select=published_on&published_on=eq.${entry.date}`,
  { headers: H }
)).json();
if (exists.length) { console.log(`${entry.date} already published — skipping insert`); }

// upload helper
async function upload(bucket, path, file, contentType) {
  const r = await fetch(`${PROJ}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": contentType, "x-upsert": "true" },
    body: fs.readFileSync(file),
  });
  if (!r.ok) throw new Error(`${bucket} upload ${r.status}: ${(await r.text()).slice(0, 160)}`);
}
await upload("analysis-covers", coverPath, entry.coverFile, "image/png");
await upload("analysis-reports", reportPath, entry.reportFile, "application/pdf");

// insert (only if new)
if (!exists.length) {
  const ins = await fetch(`${PROJ}/rest/v1/daily_analysis`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      published_on: entry.date,
      title: entry.title,
      gumlet_id: gumletId,
      description: entry.description,
      bias: entry.bias,
      session_tag: entry.session,
      is_published: true,
      cover_path: coverPath,
      report_path: reportPath,
    }),
  });
  if (!ins.ok) throw new Error(`insert ${ins.status}: ${(await ins.text()).slice(0, 200)}`);
}
console.log(`✓ published ${entry.date}`);
```

---

## 9. Mapping from the generated source files

If the asset generator follows the existing naming, the mapping is mechanical:

| Source file | Goes to |
|---|---|
| `MMFX_Thumbnail_<DATE>.png` | cover → `analysis-covers/cover-<DATE>.png` |
| `MMFX_XAUUSD_Analysis_<DATE>.pdf` | report → `analysis-reports/report-<DATE>.pdf` |
| `MMFX_Telegram_<DATE>.txt` → "TELEGRAM POST 1 — DAILY ANALYSIS" body | `description` (strip `**`, `__`, backticks → plain text) and `bias` (read the directional call) |
| The Gumlet embed URL you paste | `gumlet_id` (hash after `/embed/`) |

---

## 10. Verify it worked

```
# count + newest entry
GET {PROJ}/rest/v1/daily_analysis?select=published_on,bias,gumlet_id&order=published_on.desc&limit=3
   apikey + Authorization: Bearer <service_role>

# cover is publicly served (expect 200, image/png)
GET https://dldrcitoeoxzfctsqlmo.supabase.co/storage/v1/object/public/analysis-covers/cover-<DATE>.png
```
Then load `app.marketmakersfx.net/daily-analysis` (as a member) — the new entry is at the top, video plays, cover shows, PDF downloads.

---

## 11. Security notes
- The **service_role key is a full-access secret.** Keep it in an env var on the automation host only. Never commit it, never expose it client-side, never paste it into a chat.
- The report bucket is **private by design** — members download PDFs only through the app's authenticated `/api/reports/[id]` route. Don't make it public.
- Covers are public (they're just thumbnails) — that's intentional.

---

*Target app: `app.marketmakersfx.net` · Supabase project `dldrcitoeoxzfctsqlmo`. The app reads `daily_analysis` live, so published entries appear immediately with no deploy.*
