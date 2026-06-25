# MMFX Daily Auto-Publish — Design (Phase 1)

**Date:** 2026-06-25 · **Status:** built + verified

## Goal
Gordon pastes his daily XAUUSD analysis (speech transcript) + 4 chart
screenshots + a Gumlet link. The system produces the four locked-format
deliverables and publishes the entry live to
`app.marketmakersfx.net/daily-analysis` with no manual posting.

**Phase 1 scope:** build + publish only. No mirror-back / grading / loop-close.
**Phase 2 (separate, deferred):** a segregated Telegram agent receives the built
assets and posts them.

## Decisions (from brainstorming)
- **Scope:** build + publish only.
- **Input:** pasted transcript text (no audio/Whisper dependency). Apply MMFX STT fixups.
- **Packaging:** a Claude Code skill, `/mmfx-daily`, over deterministic builders.
- **Publish gate:** review, then publish on Gordon's explicit "publish".

## Critical finding
The workflow manual treats `build_pdf_*.py` / `build_thumbnail_*.py` /
`build_macro_image_*.py` as authoritative "exact replication" sources — but none
existed on disk; they were generated ephemerally each day. Foundation of this
work was **reconstructing them pixel-faithfully** from the 24 June 2026
deliverables (text spans, fonts, colors, vector graphics, and image placements
extracted directly from the published PDF/PNGs).

## Architecture — 4 bounded units
| Unit | Responsibility | Input → Output |
|---|---|---|
| Skill `/mmfx-daily` | Orchestration + analyst judgment (transcript→structured data) | transcript + charts + Gumlet URL → `day.json` |
| Asset builders (Python) | Deterministic locked-format rendering | `day.json` + charts → PDF + thumbnail + macro PNG |
| Telegram text builder | Render 2-post `.txt` (source of web `description`/`bias`) | `day.json` → `MMFX_Telegram_<date>.txt` |
| Publisher (`publish-daily.mjs`) | Upload cover+PDF, idempotent row insert | assets + `day.json` → live entry |

`day.json` (schema: `~/.claude/skills/mmfx-daily/schema/day.schema.json`) is the
single contract between Claude's judgment and the deterministic renderers.

## Locations
- Skill + builders + venv: `~/.claude/skills/mmfx-daily/`
- Outputs + charts: `~/Documents/Claude/Projects/MM Analyst/` (`MMFX_*_<date>.{pdf,png,txt}`)
- Publisher: `mmfx-member-app/scripts/publish-daily.mjs` (service key from `.env.local`)

## Verification (against 24 June reference)
- PDF: all 6 pages pixel-match (coords/fonts/colors/vectors); 662KB vs 663KB ref.
- Macro 1080×1080 + Thumbnail 1920×1080: visual match.
- Telegram `.txt`: byte-identical to the reference.
- Publisher: dry-run correct; read-only Supabase check confirms naming/schema match
  and that idempotency will refresh assets + skip duplicate inserts.

## Locked-format guardrail
Visual constants live in `builders/common.py` + `pil_common.py` + the coordinate
maps inside each builder. They are sacred. Only `day.json` data changes per day.
Any format change requires Gordon's explicit approval (workflow §0).
