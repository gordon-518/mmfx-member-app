import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/channel/db";
import { getLocale } from "@/i18n/server";
import { loadChatMember } from "@/lib/chat/member";
import { handleMemberMessage, defaultChatDeps } from "@/lib/chat/run";
import { supabaseChatStore } from "@/lib/chat/store";
import { MAX_MESSAGE_CHARS } from "@/lib/chat/types";
import { isDemoUser } from "@/lib/showcase";

// The in-app support chat. GET returns the member's thread; POST sends one
// message and returns what was added (the member's message, then the
// assistant's reply or the handoff note). Signed-in members only; the
// session is the identity, and all writes use the service role after that
// check (the tables have no write policies).
//
// Responses: { ok: true, data } or { ok: false, error } with a short code the
// widget maps to a message in the member's language.
//
// The shared showcase account gets no chat: everyone with the link would share
// one thread, the model budget and the team's alerts.

export const runtime = "nodejs";
// Two model calls (a draft and one redraft) at up to 30s each, plus the writes.
export const maxDuration = 90;

const HISTORY = 50;

async function signedInUser(): Promise<{ id: string; demo: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, demo: isDemoUser(data.user.email) } : null;
}

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: Request) {
  const viewer = await signedInUser();
  if (!viewer) return fail("unauthorized", 401);
  if (viewer.demo) return fail("unavailable", 403);
  const userId = viewer.id;
  try {
    const store = supabaseChatStore(adminDb());
    const [thread, messages] = await Promise.all([store.getThread(userId), store.recent(userId, HISTORY)]);
    const lastRead = thread?.member_last_read_at ? Date.parse(thread.member_last_read_at) : 0;
    const unread = messages.some((m) => m.role === "staff" && Date.parse(m.created_at) > lastRead);
    // Only when there's something new to mark: the panel polls while open.
    const reading = new URL(request.url).searchParams.get("read") === "1";
    if (thread && reading && unread) await store.markRead(userId);
    return NextResponse.json({ ok: true, data: { state: thread?.state ?? "bot", messages, unread: unread && !reading } });
  } catch (e) {
    console.error("[chat] GET failed:", e);
    return fail("server", 500);
  }
}

export async function POST(request: Request) {
  const viewer = await signedInUser();
  if (!viewer) return fail("unauthorized", 401);
  if (viewer.demo) return fail("unavailable", 403);
  const userId = viewer.id;

  let text: unknown;
  try {
    text = (await request.json())?.text;
  } catch {
    return fail("invalid", 400);
  }
  if (typeof text !== "string" || !text.trim() || text.length > MAX_MESSAGE_CHARS) return fail("invalid", 400);

  try {
    const db = adminDb();
    const member = await loadChatMember(db, userId, await getLocale());
    if (!member) return fail("unauthorized", 401);
    const deps = { ...defaultChatDeps(), store: supabaseChatStore(db) };
    const out = await handleMemberMessage(member, text, deps);
    if (out.kind === "rate_limited") return fail("rate_limited", 429);
    if (out.kind === "busy") return fail("busy", 429);
    if (out.kind === "invalid") return fail("invalid", 400);
    return NextResponse.json({ ok: true, data: { kind: out.kind, messages: out.messages } });
  } catch (e) {
    console.error("[chat] POST failed:", e);
    return fail("server", 500);
  }
}
