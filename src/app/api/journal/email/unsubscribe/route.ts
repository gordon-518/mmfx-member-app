import { NextRequest } from "next/server";
import { serviceClient } from "@/lib/journal/api";

// Public, no auth — the opaque token IS the capability. Always returns the same
// page so an unknown token reveals nothing (no enumeration).
const PAGE = (msg: string) =>
  new Response(
    `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#f6f7f9;margin:0">
      <div style="max-width:440px;margin:80px auto;background:#fff;border:1px solid #eceef1;border-radius:16px;padding:32px;text-align:center">
        <h1 style="font-size:20px;margin:0 0 10px">${msg}</h1>
        <p style="color:#6a6f78;font-size:14px;margin:0">You can re-enable emails anytime from your journal settings.</p>
      </div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    const db = serviceClient();
    await db
      .from("journal_email_prefs")
      .update({ opted_out: true, updated_at: new Date().toISOString() })
      .eq("unsub_token", token);
  }
  return PAGE("You've been unsubscribed");
}
