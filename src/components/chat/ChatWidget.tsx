"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { ChatIcon, CloseIcon } from "@/components/icons";
import { useT } from "@/i18n/client";
import type { Messages } from "@/i18n/messages/types";
import type { ChatMessage, ChatState } from "@/lib/chat/types";
import { MAX_MESSAGE_CHARS } from "@/lib/chat/types";
import { MessageText } from "./messageText";

// The in-app help chat: a button in the corner and a panel. It lives in the
// root layout, so it keeps its conversation across page changes, and it only
// appears for a signed-in member (the first GET answers 401 otherwise).
//
// The assistant answers in the POST's response. When it hands over to a
// person, the panel polls for the team's reply: every 10s while open, every
// minute while closed (to light the unread dot).

const HIDDEN_ON = ["/login", "/signup", "/forgot-password", "/auth", "/admin", "/partners", "/stats", "/showcase"];
const POLL_OPEN_MS = 10_000;
const POLL_CLOSED_MS = 60_000;

type Msg = Omit<ChatMessage, "id"> & { id: number | string };
type ErrorCode = keyof Messages["chat"]["errors"];

interface ThreadData {
  state: ChatState;
  messages: ChatMessage[];
  unread: boolean;
}

async function fetchThread(markRead: boolean): Promise<ThreadData | "signed-out" | null> {
  try {
    const res = await fetch(`/api/chat${markRead ? "?read=1" : ""}`, { cache: "no-store" });
    if (res.status === 401) return "signed-out";
    const json = await res.json();
    return json?.ok ? (json.data as ThreadData) : null;
  } catch {
    return null;
  }
}

export function ChatWidget() {
  const pathname = usePathname() ?? "";
  const c = useT().chat;
  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [state, setState] = useState<ChatState>("bot");
  const [unread, setUnread] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingSeq = useRef(0);

  const apply = useCallback((data: ThreadData | "signed-out" | null, markRead: boolean) => {
    if (data === "signed-out") {
      setAvailable(false);
      return;
    }
    if (!data) return;
    setAvailable(true);
    setMessages(data.messages);
    setState(data.state);
    setUnread(markRead ? false : data.unread);
  }, []);

  const load = useCallback((markRead: boolean) => fetchThread(markRead).then((d) => apply(d, markRead)), [apply]);

  // First look: is anyone signed in, and is there a conversation already?
  useEffect(() => {
    if (hidden) return;
    let live = true;
    fetchThread(false).then((d) => {
      if (live) apply(d, false);
    });
    return () => {
      live = false;
    };
  }, [hidden, apply]);

  // Waiting for a person: check for their reply.
  useEffect(() => {
    if (!available || state !== "needs_human") return;
    const id = setInterval(() => void load(open), open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => clearInterval(id);
  }, [available, state, open, load]);

  // Keep the latest message in view, and the cursor in the box.
  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, pending]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load(true);
  };

  async function send(text: string) {
    const body = text.trim();
    if (!body || pending) return;
    if (body.length > MAX_MESSAGE_CHARS) {
      setError("invalid");
      return;
    }
    const tempId = `pending-${++pendingSeq.current}`;
    setError(null);
    setPending(true);
    setDraft("");
    setMessages((prev) => [...prev, { id: tempId, role: "member", body, created_at: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = (json?.error as ErrorCode | undefined) ?? "server";
        setError(code in c.errors ? code : "server");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(body);
        return;
      }
      const added = json.data.messages as ChatMessage[];
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), ...added]);
      if (json.data.kind === "handoff" || json.data.kind === "queued") setState("needs_human");
    } catch {
      setError("server");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
    } finally {
      setPending(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
    if (e.key === "Escape") setOpen(false);
  };

  if (hidden || !available) return null;

  const suggestions = Object.values(c.suggestions);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? c.close : c.openAria}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-orange text-white shadow-soft-lg transition-transform hover:scale-105 hover:bg-[#f24e12] print:hidden"
      >
        {open ? <CloseIcon width={22} height={22} /> : <ChatIcon width={24} height={24} />}
        {unread && !open && (
          <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-ink" title={c.unread}>
            <span className="sr-only">{c.unread}</span>
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label={c.title}
          className="fixed inset-x-0 bottom-0 z-[60] flex h-[85vh] flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-soft-lg sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[560px] sm:max-h-[calc(100vh-8rem)] sm:w-[380px] sm:rounded-2xl print:hidden"
        >
          <header className="flex items-start justify-between gap-3 border-b border-line bg-accent-soft/40 px-4 py-3.5">
            <div className="min-w-0">
              <p className="font-display text-[16px] font-bold tracking-tight text-ink">{c.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-subtle">{c.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={c.close}
              className="-mr-1 shrink-0 cursor-pointer rounded-lg p-1 text-faint transition-colors hover:bg-paper hover:text-ink"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <Bubble who={c.assistant} tone="assistant">
              <MessageText text={c.greeting} />
            </Bubble>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="cursor-pointer rounded-full border border-line-strong bg-card px-3 py-1.5 text-left text-[12.5px] font-medium text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) =>
              m.role === "system" ? (
                <p key={m.id} className="px-2 text-center text-[12px] leading-relaxed text-faint">
                  {m.body === "resolved" ? c.resolved : c.handoff}
                </p>
              ) : (
                <Bubble
                  key={m.id}
                  who={m.role === "member" ? c.you : m.role === "staff" ? c.team : c.assistant}
                  tone={m.role === "member" ? "member" : m.role === "staff" ? "staff" : "assistant"}
                >
                  <MessageText text={m.body} />
                </Bubble>
              )
            )}
            {pending && (
              <Bubble who={c.assistant} tone="assistant">
                <span className="animate-pulse text-subtle">{c.thinking}</span>
              </Bubble>
            )}
            {state === "needs_human" && !pending && messages.at(-1)?.role === "member" && (
              <p className="px-2 text-center text-[12px] text-faint">{c.waiting}</p>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="border-t border-line bg-card px-3 pb-3 pt-2.5">
            {error && (
              <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-[12.5px] text-red-800">
                {c.errors[error]}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                maxLength={MAX_MESSAGE_CHARS}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
                className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15"
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                className="h-[42px] shrink-0 cursor-pointer rounded-xl bg-orange px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#f24e12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? c.sending : c.send}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-faint">{c.noAdvice}</p>
          </form>
        </section>
      )}
    </>
  );
}

function Bubble({ who, tone, children }: { who: string; tone: "member" | "assistant" | "staff"; children: React.ReactNode }) {
  const mine = tone === "member";
  const style =
    tone === "member"
      ? "bg-orange text-white"
      : tone === "staff"
        ? "border border-ink/10 bg-ink text-white"
        : "border border-line bg-paper text-ink";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="mb-0.5 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">{who}</span>
      <div className={`max-w-[88%] break-words rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${style}`}>{children}</div>
    </div>
  );
}
