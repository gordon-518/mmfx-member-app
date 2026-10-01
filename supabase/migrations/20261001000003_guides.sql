-- ============================================================================
-- Guides store (design doc 2026-10-01 "Daily guides — database-backed
-- publishing", §2).
--
-- WHY. Guides were JSON files in the marketing site's repo: one pull request,
-- one review, one deploy per guide. That is a fine cadence for three guides and
-- an impossible one for the daily guide Gordon asked for — the brain runs on a
-- VPS with no GitHub access, and a deploy per day is a deploy per day. So the
-- row moves here: the brain composes a guide, runs its own compliance gate,
-- waits for the first-per-feature approval, and POSTs the finished v2 object to
-- /api/guides. The marketing site reads it back through the public routes with
-- ISR. No pull requests, no deploys, no GitHub credential on the VPS.
--
-- The row IS the guide JSON v2 contract (2026-10-01-guide-v2-design.md §2),
-- one column per key, snake_case here and camelCase over the wire. The three
-- shapes the contract types rather than names — h2s, takeaways, cover, visuals
-- — are jsonb, because Postgres is not where that shape is enforced:
-- src/lib/guides/validate.ts is, on the way in AND on the way out. A row that
-- would not validate is a row the routes refuse to serve, so a bad write can
-- never render a half-built page.
--
-- Nothing here is read by a browser. The table is service-role only and the
-- public reads through GET /api/guides, never the table: that route is also
-- where the cache header and the validation live.
--
-- Additive: one new table, one trigger, two indexes. Nothing is dropped and no
-- existing object changes. Rollback dry run (begin … rollback) before applying
-- through the Management API, as with the email, partner and SEO migrations.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- guides — one row per guide, keyed by the slug the URL carries.
--
-- The slug is the primary key rather than a surrogate id because the slug is
-- the identity everywhere else: it is the URL, it is the upsert's conflict
-- target, it is what the SEO cid (`SEO-guide-<slug>`, 20261001000001) is built
-- from, and it is what the brain's topic backlog records against a used topic.
-- A guide whose slug changes is a new guide with a new URL, which is exactly
-- what a new row means.
--
-- status is 'unpublished' rather than deleted for the same reason the email
-- variants retire rather than vanish: attribution_touches and email_sends rows
-- already name the slug, and a store that cannot say what a withdrawn guide
-- said is not a store. DELETE /api/guides/[slug] flips this column; nothing
-- deletes a row.
-- ---------------------------------------------------------------------------
create table if not exists public.guides (
  slug          text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  feature       text not null,
  title         text not null,
  description   text not null,
  published_on  date not null,
  cid           text not null,
  h2s           jsonb not null,
  body_markdown text not null,
  takeaways     jsonb not null,
  pull_quote    text,
  cover         jsonb not null,
  visuals       jsonb not null,
  status        text not null default 'published' check (status in ('published','unpublished')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.guides is
  'The guide store — one row per guide in the JSON v2 shape (guide-v2 design §2), written by the brain via POST /api/guides and read by the marketing site through GET /api/guides. Service role only; the shape is enforced in src/lib/guides/validate.ts, not here.';

comment on column public.guides.slug is
  'URL slug and primary key; the upsert conflict target and the stem of the SEO cid (SEO-guide-<slug>). Kebab-case, checked here as well as in the validator.';
comment on column public.guides.feature is
  'The marketing site feature slug this guide belongs to (features.ts: daily-analysis, mm-system, fundamental-desk, …). Drives the rotation the brain composes on.';
comment on column public.guides.published_on is
  'ISO publication date. Sorts the list newest first and feeds the sitemap''s lastModified.';
comment on column public.guides.cid is
  'Campaign id the guide''s email links carry, e.g. EML-spotlight-fundamental-desk.';
comment on column public.guides.h2s is
  'jsonb array of strings: the body''s "## " headings, in order and complete. Placement.section indexes into this list, so the two must not drift — the validator fails a row where they do.';
comment on column public.guides.body_markdown is
  'The guide itself, Markdown. The site splits it on "## " and interleaves the visual blocks by their Placement.';
comment on column public.guides.takeaways is
  'jsonb array of 3–5 plain-text rail bullets, each <= 140 chars.';
comment on column public.guides.pull_quote is
  'One line of the guide''s own argument, <= 160 chars. The only optional v2 key, hence the only nullable one.';
comment on column public.guides.cover is
  'jsonb GuideCover: the illustrated chart cover, which is also the Open Graph image. { kind: "chart", title, label, candles[8-14], levels[0-3] }.';
comment on column public.guides.visuals is
  'jsonb array of 2–6 typed VisualBlocks (compare | cards | pipeline | flow | stack | quote), each carrying its Placement. At most one compare, one flow and one stack per guide.';
comment on column public.guides.status is
  'published | unpublished. The public routes serve published rows only; the export serves both. Nothing deletes a row — a withdrawn guide is still named by attribution rows.';


-- ---------------------------------------------------------------------------
-- updated_at — the shared trigger (20260609162252, hardened 20260610140125).
--
-- The nightly export is a diff against yesterday's file, and DELETE only flips
-- `status`, so "when did this row last move" cannot be left to whichever route
-- remembered to set it.
-- ---------------------------------------------------------------------------
drop trigger if exists guides_set_updated_at on public.guides;
create trigger guides_set_updated_at
  before update on public.guides
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Indexes.
--
-- The first is the public list query verbatim: `where status = 'published'
-- order by published_on desc`. The second serves the brain's rotation, which
-- asks what has already been published for a feature before it composes.
-- ---------------------------------------------------------------------------
create index if not exists guides_status_published_idx
  on public.guides (status, published_on desc);

create index if not exists guides_feature_idx
  on public.guides (feature);


-- ---------------------------------------------------------------------------
-- Least privilege. RLS on with no policies is the project's "service role
-- only" idiom (email_sends, email_spotlights); the explicit revoke/grant makes
-- it true at the table level too, so the schema stands on its own with
-- auto_expose_new_tables = false.
-- ---------------------------------------------------------------------------
alter table public.guides enable row level security;

revoke all on table public.guides from public, anon, authenticated;
grant select, insert, update, delete on table public.guides to service_role;
