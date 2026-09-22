import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { templateFor } from "@/lib/email/lifecycle";
import { lintEmail } from "@/lib/email/compliance";
import type { LifecycleCopy } from "@/lib/email/lifecycle/types";

// The brain's drop-off point for an APPROVED challenger arm (design doc §4).
//
// Same contract as /api/email/spotlight: the composing, the gating and the
// human approval all happen in MM Main Marketing Brain, and POSTing here IS
// the approval. This route's job is only to refuse what could not have been
// approved — a step the rail cannot send, copy outside its limits, or words
// the compliance gate blocks — so a bug in the brain cannot mail the whole
// trial cohort a claim we would never make.
//
// Arm 'A' is not storable: the control is the template's own copy, in code,
// and promoting a winner is a PR that rewrites it (spec §5.6).
//
// DELETE retires an arm (active = false, retired_at = now) rather than
// removing the row: email_sends rows still name that variant, and a KPI table
// that cannot say what 'B' was is not a KPI table.

export const dynamic = "force-dynamic";

const LIMITS = { subject: 45, preheader: 90, ctaLabel: 28, paragraphs: 3 } as const;

/** The two steps whose body is data, not paragraphs (§0.2). */
const BODYLESS = new Set(["nurture/digest", "nurture/spotlight"]);

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** null when the copy is usable, otherwise the reason it is not. */
export function copyProblem(raw: unknown, key: string): string | null {
  if (!raw || typeof raw !== "object") return "copy must be an object";
  const c = raw as Record<string, unknown>;

  for (const field of ["subject", "preheader", "ctaLabel"] as const) {
    const value = c[field];
    if (typeof value !== "string" || !value.trim()) return `${field} is required`;
    if (value.trim().length > LIMITS[field]) {
      return `${field} must be ${LIMITS[field]} characters or fewer`;
    }
  }

  const paragraphs = c.paragraphs;
  if (!Array.isArray(paragraphs)) return "paragraphs must be an array";
  if (paragraphs.some((p) => typeof p !== "string" || !p.trim())) {
    return "paragraphs must all be non-empty strings";
  }
  if (paragraphs.length > LIMITS.paragraphs) {
    return `paragraphs must be ${LIMITS.paragraphs} or fewer`;
  }
  // The digest is its analysis card and the spotlight is the brain's own body,
  // so neither has paragraphs of its own; every other step must say something.
  if (!paragraphs.length && !BODYLESS.has(key)) return "paragraphs must have at least one entry";

  return null;
}

function cleanCopy(raw: Record<string, unknown>): LifecycleCopy {
  return {
    subject: String(raw.subject).trim(),
    preheader: String(raw.preheader).trim(),
    paragraphs: (raw.paragraphs as string[]).map((p) => p.trim()),
    ctaLabel: String(raw.ctaLabel).trim(),
  };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "a JSON object is required" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const flow = str(b.flow);
  const step = str(b.step);
  if (!flow || !step || !templateFor(flow, step)) {
    return NextResponse.json(
      { error: `the rail has no template for ${flow}/${step}` },
      { status: 400 }
    );
  }

  const variantKey = str(b.variant_key);
  if (!variantKey || !/^[B-Z][A-Z0-9-]{0,15}$/.test(variantKey)) {
    return NextResponse.json(
      { error: "variant_key must be an arm from B onwards; 'A' is the template's own copy" },
      { status: 400 }
    );
  }

  const weight = b.weight === undefined ? 50 : Number(b.weight);
  if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
    return NextResponse.json({ error: "weight must be an integer 0–100" }, { status: 400 });
  }

  const problem = copyProblem(b.copy, `${flow}/${step}`);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const copy = cleanCopy(b.copy as Record<string, unknown>);

  // The gate, over everything a reader would see. `review` is allowed through:
  // a human already read this copy in the brain, and review-level language is
  // legitimate in a members-only email. `block` never is.
  const lint = lintEmail(
    [copy.subject, copy.preheader, ...copy.paragraphs, copy.ctaLabel].join("\n")
  );
  if (lint.verdict === "block") {
    return NextResponse.json({ error: "compliance", ...lint }, { status: 422 });
  }

  const db = serviceClient();
  const { data, error } = await db
    .from("email_variants")
    .upsert(
      {
        flow,
        step,
        variant_key: variantKey,
        copy,
        weight,
        active: true,
        created_by: str(b.created_by) ?? "brain",
        rationale: str(b.rationale),
        approved_at: new Date().toISOString(),
        retired_at: null,
      },
      { onConflict: "flow,step,variant_key" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("[api/email/variants] upsert failed:", error.message);
    return NextResponse.json({ error: "upsert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const flow = str(params.get("flow"));
  const step = str(params.get("step"));
  const variantKey = str(params.get("variant_key"));
  if (!flow || !step || !variantKey) {
    return NextResponse.json(
      { error: "flow, step and variant_key are all required" },
      { status: 400 }
    );
  }

  const db = serviceClient();
  const { data, error } = await db
    .from("email_variants")
    .update({ active: false, retired_at: new Date().toISOString() })
    .eq("flow", flow)
    .eq("step", step)
    .eq("variant_key", variantKey)
    .select("id");

  if (error) {
    console.error("[api/email/variants] retire failed:", error.message);
    return NextResponse.json({ error: "retire failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, retired: (data ?? []).length });
}
