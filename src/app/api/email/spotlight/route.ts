import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";

// The brain's drop-off point for an approved weekly feature spotlight
// (design doc §5). MM Main Marketing Brain composes the guide + email in one
// Opus pass, runs its own compliance gate, waits for the Notion approval, and
// only then POSTs here. The member app never composes a spotlight; it only
// sends what is already in this table, and the lifecycle cron picks the
// NEWEST approved row.
//
// Bearer CRON_SECRET, the same secret the cron job uses — this is a
// machine-to-machine endpoint with no browser path.

interface SpotlightBody {
  subject?: unknown;
  html?: unknown;
  text?: unknown;
  guide_url?: unknown;
  cid?: unknown;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// The spotlight body is a BODY FRAGMENT: the rail supplies the document, the
// shell and the footer. Anything that would make it a document of its own, or
// that executes, is rejected at the door rather than stored and mailed to the
// whole Free tier. Cheap, and the brain has no reason to send any of it.
const FORBIDDEN = ["<script", "<style", "<iframe", "<html", "<body", "javascript:"];

function unsafeFragment(html: string): string | null {
  const lower = html.toLowerCase();
  return FORBIDDEN.find((f) => lower.includes(f)) ?? null;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SpotlightBody;
  const subject = str(body.subject);
  const html = str(body.html);
  const text = str(body.text);
  if (!subject || !html || !text) {
    return NextResponse.json({ error: "subject, html and text are required" }, { status: 400 });
  }

  const unsafe = unsafeFragment(html);
  if (unsafe) {
    return NextResponse.json(
      { error: `html must be a body fragment; found "${unsafe}"` },
      { status: 400 }
    );
  }

  const db = serviceClient();
  const { data, error } = await db
    .from("email_spotlights")
    .insert({
      subject,
      html,
      text,
      guide_url: str(body.guide_url),
      cid: str(body.cid),
      // Posting it here IS the approval: the gate ran in the brain.
      approved_at: new Date().toISOString(),
    })
    .select("id, approved_at")
    .single();

  if (error) {
    console.error("[api/email/spotlight] insert failed:", error.message);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id, approved_at: data?.approved_at });
}
