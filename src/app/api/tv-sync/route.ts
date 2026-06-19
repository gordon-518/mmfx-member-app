import { NextRequest, NextResponse } from "next/server";
import { grantTVAccess, revokeTVAccess } from "@/lib/tv/client";
import type { AccountStatus } from "@/lib/trial/status";

// Statuses that grant TV access. Everything else revokes.
const ACTIVE = new Set<AccountStatus>(["trial_active", "re_trial_active", "member_active"]);

// Supabase Database Webhook payload shape (UPDATE events on public.profiles)
interface WebhookPayload {
  type: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!process.env.TV_WEBHOOK_SECRET || secret !== process.env.TV_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "UPDATE") {
    return NextResponse.json({ skipped: "not an UPDATE" });
  }

  const rec = payload.record;
  const old = payload.old_record ?? {};

  const usernameChanged = rec.tradingview_username !== old.tradingview_username;
  const statusChanged   = rec.account_status !== old.account_status;

  if (!usernameChanged && !statusChanged) {
    return NextResponse.json({ skipped: "no relevant change" });
  }

  // If the username itself changed, revoke access on the old handle first
  const oldUsername = old.tradingview_username as string | null;
  if (usernameChanged && oldUsername) {
    await revokeTVAccess(oldUsername).catch(console.error);
  }

  const tvUsername = rec.tradingview_username as string | null;
  if (!tvUsername) {
    return NextResponse.json({ skipped: "no tradingview_username on record" });
  }

  const status = rec.account_status as AccountStatus;

  if (ACTIVE.has(status)) {
    // members get permanent access; trial users get time-limited (TV auto-revokes)
    const trialEndsAt = status === "member_active"
      ? null
      : (rec.trial_ends_at as string | null);
    const result = await grantTVAccess(tvUsername, trialEndsAt);
    return NextResponse.json(result);
  } else {
    const result = await revokeTVAccess(tvUsername);
    return NextResponse.json(result);
  }
}
