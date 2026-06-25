import "server-only";
import { createClient } from "@supabase/supabase-js";
import { addContactsToBook, type BookContact } from "@/lib/sendpulse";
import { audienceFor } from "@/lib/audience";
import type { AccountStatus } from "@/lib/trial/status";

export interface SendpulseSyncResult {
  total: number;
  synced: number;
  ok: boolean;
  counts: Record<string, number>;
  error?: string;
}

// Stamp every member's current status onto their SendPulse contact in the
// signups book so the list can be segmented for follow-up email flows. Shared
// by the nightly cron and the admin "Run sync now" button. Upsert — also
// backfills anyone missing from the book.
export async function syncSendpulseAudiences(): Promise<SendpulseSyncResult> {
  const empty = { total: 0, synced: 0, ok: false, counts: {} as Record<string, number> };

  const book = process.env.SENDPULSE_BOOK_ID;
  if (!book) return { ...empty, error: "SENDPULSE_BOOK_ID not set" };

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: users, error } = await admin
    .from("profiles")
    .select("email, full_name, account_status, trial_ends_at");
  if (error) return { ...empty, error: error.message };

  const now = Date.now();
  const counts: Record<string, number> = { member: 0, trial: 0, expired: 0, removed: 0 };
  const contacts: BookContact[] = [];

  for (const u of users ?? []) {
    const email = (u.email as string | null)?.trim();
    if (!email) continue;
    const status = u.account_status as AccountStatus;
    const trialEndsAt = (u.trial_ends_at as string | null) ?? null;
    const audience = audienceFor(status, trialEndsAt, now);
    counts[audience] = (counts[audience] ?? 0) + 1;

    const variables: Record<string, string> = { audience, account_status: status };
    if (u.full_name) variables.Name = u.full_name as string;
    if (trialEndsAt) variables.trial_ends_at = trialEndsAt.slice(0, 10);
    contacts.push({ email, variables });
  }

  const result = await addContactsToBook(book, contacts);
  return { total: contacts.length, synced: result.added, ok: result.ok, counts };
}
