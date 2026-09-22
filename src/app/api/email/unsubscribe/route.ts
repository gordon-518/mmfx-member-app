import { NextRequest } from "next/server";
import { serviceClient } from "@/lib/journal/api";

// Global marketing opt-out for the lifecycle rail. Public, no auth — the
// opaque token IS the capability, and it always returns the same page, so an
// unknown token reveals nothing (no enumeration). Same markup as the journal's
// unsubscribe page (api/journal/email/unsubscribe).
//
// GET  — the link in the email footer, clicked by a human.
// POST — the RFC 8058 one-click path. Gmail and Yahoo POST here directly from
//        the List-Unsubscribe-Post header, with no body and no session.
//
// This is the MARKETING scope only: journal_email_prefs is a separate consent
// and is deliberately untouched.

const PAGE = (msg: string) =>
  new Response(
    `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#f6f7f9;margin:0">
      <div style="max-width:440px;margin:80px auto;background:#fff;border:1px solid #eceef1;border-radius:16px;padding:32px;text-align:center">
        <h1 style="font-size:20px;margin:0 0 10px">${msg}</h1>
        <p style="color:#6a6f78;font-size:14px;margin:0">You can re-enable emails anytime from your account settings.</p>
      </div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

async function optOut(token: string | null): Promise<void> {
  if (!token) return;
  const db = serviceClient();
  await db
    .from("email_prefs")
    .update({ marketing_opted_out: true, updated_at: new Date().toISOString() })
    .eq("unsub_token", token);
}

export async function GET(req: NextRequest) {
  await optOut(req.nextUrl.searchParams.get("token"));
  return PAGE("You've been unsubscribed");
}

export async function POST(req: NextRequest) {
  await optOut(req.nextUrl.searchParams.get("token"));
  return PAGE("You've been unsubscribed");
}
