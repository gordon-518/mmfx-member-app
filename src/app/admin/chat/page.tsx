import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";
import { setChatEnabled, replyToMember, resolveThread } from "./actions";

// Admin inbox for the in-app support chat: the assistant's switch, the
// conversations waiting for a person, and one conversation with a reply box.
// Reads go through RLS (admins see every thread); writes are server actions.

export const dynamic = "force-dynamic";

interface ThreadRow {
  user_id: string;
  state: "bot" | "needs_human";
  locale: string | null;
  handoff_reason: string | null;
  updated_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
}
interface MessageRow {
  id: number;
  role: "member" | "assistant" | "staff" | "system";
  body: string;
  topic: string | null;
  confidence: number | null;
  created_at: string;
}

const sgt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Singapore", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const label = "text-[11px] font-semibold uppercase tracking-wider text-faint";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_STYLE: Record<MessageRow["role"], string> = {
  member: "bg-paper text-ink",
  assistant: "bg-accent-soft/50 text-ink",
  staff: "bg-ink text-white",
  system: "bg-transparent text-faint italic",
};
const SYSTEM_TEXT: Record<string, string> = {
  handoff: "Handed to the team: the member was told a person will reply.",
  resolved: "Handed back to the assistant.",
};

export default async function ChatAdminPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || isAdmin !== true) {
    return <main className="p-10 text-[14px] text-subtle">Not authorized.</main>;
  }

  const { user: selectedRaw } = await searchParams;
  const selected = selectedRaw && UUID_RE.test(selectedRaw) ? selectedRaw : null;

  const [{ data: s }, { data: threads }, { data: msgs }] = await Promise.all([
    supabase.from("support_settings").select("chat_enabled").eq("id", 1).maybeSingle(),
    supabase
      .from("chat_threads")
      .select("user_id, state, locale, handoff_reason, updated_at, profiles(email, full_name)")
      .order("updated_at", { ascending: false })
      .limit(100),
    selected
      ? supabase
          .from("chat_messages")
          .select("id, role, body, topic, confidence, created_at")
          .eq("user_id", selected)
          .order("created_at", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] as MessageRow[] }),
  ]);
  const enabled = (s as { chat_enabled?: boolean } | null)?.chat_enabled !== false;
  const all = (threads ?? []) as unknown as ThreadRow[];
  const waiting = all.filter((t) => t.state === "needs_human");
  const current = selected ? all.find((t) => t.user_id === selected) ?? null : null;
  const conversation = (msgs ?? []) as MessageRow[];
  const who = (t: ThreadRow | null) => t?.profiles?.email ?? t?.profiles?.full_name ?? t?.user_id ?? "";

  return (
    <main className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/dashboard"><Wordmark /></Link>
        <Link href="/admin" className="text-[13px] font-semibold text-subtle hover:text-ink">← Admin</Link>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className={label}>In-app chat</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              {enabled ? "Assistant on: answering members" : "Assistant off: every message comes to the team"}
            </h1>
            <p className="mt-1 text-[13px] text-subtle">
              Waiting for a person: <span className="font-semibold text-ink">{waiting.length}</span>. Members see the
              assistant&apos;s replies in their own language; reply in theirs if you can (the locale is shown).
            </p>
          </div>
          <form action={setChatEnabled}>
            <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
            <button className={`rounded-xl px-5 py-2.5 text-[14px] font-semibold ${enabled ? "border border-line-strong bg-card text-ink" : "bg-orange text-white"}`}>
              {enabled ? "Turn the assistant off" : "Turn the assistant on"}
            </button>
          </form>
        </section>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-line bg-card p-3">
            <p className={`${label} px-2 py-1.5`}>Conversations</p>
            <ul className="divide-y divide-line">
              {all.map((t) => (
                <li key={t.user_id}>
                  <Link
                    href={`/admin/chat?user=${t.user_id}`}
                    className={`block rounded-lg px-2 py-2.5 text-[13px] transition-colors hover:bg-paper ${t.user_id === selected ? "bg-accent-soft/40" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-ink">{who(t)}</span>
                      {t.state === "needs_human" && (
                        <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold uppercase text-white">Needs you</span>
                      )}
                    </span>
                    <span className="block truncate text-[12px] text-subtle">
                      {t.locale ?? "en"} · {sgt(t.updated_at)}{t.handoff_reason ? ` · ${t.handoff_reason}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
              {!all.length && <li className="px-2 py-3 text-[13px] text-subtle">No conversations yet.</li>}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            {!current ? (
              <p className="text-[13.5px] text-subtle">Pick a conversation.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-ink">{who(current)}</h2>
                    <p className="text-[12.5px] text-subtle">
                      Language: {current.locale ?? "en"} · {current.state === "needs_human" ? `With the team (${current.handoff_reason ?? "handed off"})` : "With the assistant"}
                    </p>
                  </div>
                  {current.state === "needs_human" && (
                    <form action={resolveThread}>
                      <input type="hidden" name="user_id" value={current.user_id} />
                      <button className="rounded-lg border border-line-strong px-3 py-1.5 text-[12.5px] font-semibold text-ink">
                        Done: back to the assistant
                      </button>
                    </form>
                  )}
                </div>

                <ol className="mt-4 space-y-2">
                  {conversation.map((m) => (
                    <li key={m.id} className={`rounded-xl px-3.5 py-2.5 text-[13.5px] ${ROLE_STYLE[m.role]}`}>
                      <span className={`${label} block ${m.role === "staff" ? "text-white/60" : ""}`}>
                        {m.role} · {sgt(m.created_at)}
                        {m.topic ? ` · ${m.topic}` : ""}
                        {m.confidence != null ? ` · ${Number(m.confidence).toFixed(2)}` : ""}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap">{m.role === "system" ? SYSTEM_TEXT[m.body] ?? m.body : m.body}</span>
                    </li>
                  ))}
                </ol>

                <form action={replyToMember} className="mt-4 space-y-2">
                  <input type="hidden" name="user_id" value={current.user_id} />
                  <textarea
                    name="body"
                    required
                    rows={4}
                    maxLength={4000}
                    placeholder="Reply to the member. They see it in the chat panel the next time it refreshes."
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink"
                  />
                  <button className="rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white">Send reply</button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
