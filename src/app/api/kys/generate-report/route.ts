import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAccess } from "@/lib/access";
import { canAccess } from "@/lib/access/features";
import { createClient } from "@/lib/supabase/server";
import { QUESTIONS } from "@/lib/kys/questions";
import { scoreAnswers } from "@/lib/kys/scoring";
import { scoreDimensions } from "@/lib/kys/dimensions";
import { selectMoves } from "@/lib/kys/moves";
import { getArchetype } from "@/lib/kys/archetypes";
import { buildDynamicContext, staticSystemPrompt } from "@/lib/kys/prompt";
import { finalizeReport, validateReport } from "@/lib/kys/validation";
import { REPORT_LANGUAGE } from "@/lib/kys/reportLanguage";
import type { GenerateReportResponse, UserAnswers } from "@/lib/kys/types";
import { getLocale, messagesFor } from "@/i18n/server";

// Know Your Style, now native (21 Oct). This replaces the standalone app's
// /api/generate-report: same deterministic scoring and the same prompt, but
// the member is resolved from the Supabase session, the archetype is computed
// HERE from the answers rather than trusted from the client, and the finished
// profile is saved to the member's row so the dashboard, the welcome
// checklist and the upgrade plan finder can use it.
//
// The report is written in the member's language (Nov 2026): the same prompt
// with that language's headings and footer, and more room to write it in.
// English is unchanged.

export const runtime = "nodejs";
export const maxDuration = 60;

// Haiku writes the report; Sonnet is the retry when Haiku's output fails the
// structure gate (lib/kys/validation.ts). Matching the standalone app's pair.
const HAIKU = "claude-haiku-4-5-20251001";
// The standalone app retried on "claude-sonnet-4-6", which is not a current
// model id — that fallback would have 404d. Sonnet 5 is the live one.
const SONNET = "claude-sonnet-5";

interface ReportRequest {
  staticPrompt: string;
  dynamicContext: string;
  maxTokens: number;
}

async function writeReport(model: string, r: ReportRequest): Promise<string> {
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const res = await client.messages.create({
    model,
    max_tokens: r.maxTokens,
    temperature: 0.6,
    system: [
      // The static half is cached: every assessment in a language sends the
      // same voice and structure rules.
      { type: "text", text: r.staticPrompt, cache_control: { type: "ephemeral" } },
      { type: "text", text: r.dynamicContext },
    ],
    messages: [{ role: "user", content: "Generate the personalised report now." }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no text in the model's reply");
  return block.text;
}

export async function POST(req: Request) {
  const access = await getAccess();
  if (!access.signedIn || !access.profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Know Your Style is open on every tier; the check keeps the route honest
  // if that ever changes.
  const allowed =
    canAccess("know-your-style", { tier: access.memberTier, isAdmin: access.profile.is_admin }) ||
    access.profile.is_admin;
  if (!allowed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Accept only known question ids with an option that exists. A stray or
  // invented answer would otherwise skew the deterministic scores.
  const raw = (body as { answers?: unknown } | null)?.answers;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "answers are required" }, { status: 400 });
  }
  const answers: UserAnswers = {};
  for (const q of QUESTIONS) {
    const picked = (raw as Record<string, unknown>)[q.id];
    if (typeof picked !== "string" || !q.options.some((o) => o.id === picked)) {
      return NextResponse.json({ error: `answer missing or unknown for ${q.id}` }, { status: 400 });
    }
    answers[q.id] = picked;
  }

  // Computed here, not taken from the client.
  const archetype = scoreAnswers(answers);
  const profile = getArchetype(archetype);
  if (!profile) {
    return NextResponse.json({ error: "could not score this assessment" }, { status: 500 });
  }
  const dimensions = scoreDimensions(answers);
  const locale = await getLocale();
  const moves = selectMoves(archetype, dimensions, messagesFor(locale));

  let reportText: string;
  try {
    const request: ReportRequest = {
      staticPrompt: staticSystemPrompt(locale),
      dynamicContext: buildDynamicContext(profile, answers, dimensions, locale),
      maxTokens: REPORT_LANGUAGE[locale].maxTokens,
    };
    reportText = await writeReport(HAIKU, request);
    if (!validateReport(reportText, locale).ok) {
      // One retry on the stronger model, exactly as the standalone app did.
      reportText = await writeReport(SONNET, request);
    }
  } catch (e) {
    console.error("[kys] report generation failed:", e);
    return NextResponse.json({ error: "report generation failed" }, { status: 502 });
  }

  const check = validateReport(reportText, locale);
  if (!check.ok) {
    console.error(`[kys] ${locale} report failed validation after the retry:`, check.reason);
    return NextResponse.json({ error: "report generation failed" }, { status: 502 });
  }
  reportText = finalizeReport(reportText, locale);

  // Save the profile. A failure here must not cost the member their report —
  // they already answered 14 questions — so it's logged, not surfaced.
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_save_kys_result", {
      p_archetype: archetype,
      p_dimensions: dimensions,
      p_report: reportText,
    });
    if (error) console.error("[kys] saving the profile failed:", error.message);
  } catch (e) {
    console.error("[kys] saving the profile threw:", e);
  }

  const payload: GenerateReportResponse = {
    report_text: reportText,
    archetype,
    dimensions,
    moves,
    generated_at: new Date().toISOString(),
  };
  return NextResponse.json(payload);
}
