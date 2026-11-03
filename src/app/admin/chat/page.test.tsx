import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The admin inbox is a server component with no client JS, so its whole
// output is its markup: render it against a fake Supabase client.

const state = vi.hoisted(() => ({ isAdmin: true, threads: [] as unknown[], messages: [] as unknown[] }));

function query(rows: unknown) {
  const q: Record<string, unknown> = {};
  for (const k of ["select", "eq", "order", "limit"]) q[k] = () => q;
  q.maybeSingle = async () => ({ data: { chat_enabled: true } });
  q.then = (resolve: (v: unknown) => void) => resolve({ data: rows });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    rpc: async () => ({ data: state.isAdmin }),
    from: (table: string) => query(table === "chat_threads" ? state.threads : table === "chat_messages" ? state.messages : null),
  }),
}));
vi.mock("./actions", () => ({ setChatEnabled: async () => {}, replyToMember: async () => {}, resolveThread: async () => {} }));
vi.mock("@/components/AppShell", () => ({ Wordmark: () => null }));

import ChatAdminPage from "./page";

const USER = "11111111-2222-3333-4444-555555555555";

async function render(user?: string) {
  return renderToStaticMarkup(await ChatAdminPage({ searchParams: Promise.resolve({ user }) }));
}

describe("/admin/chat", () => {
  beforeEach(() => {
    state.isAdmin = true;
    state.threads = [
      { user_id: USER, state: "needs_human", locale: "zh-Hant", handoff_reason: "asked for a person", updated_at: "2026-11-04T02:00:00Z", profiles: { email: "m@example.com", full_name: "Mei" } },
    ];
    state.messages = [
      { id: 1, role: "member", body: "我想找真人", topic: null, confidence: null, created_at: "2026-11-04T01:59:00Z" },
      { id: 2, role: "system", body: "handoff", topic: null, confidence: null, created_at: "2026-11-04T02:00:00Z" },
      { id: 3, role: "staff", body: "<b>hi</b>", topic: null, confidence: null, created_at: "2026-11-04T02:05:00Z" },
    ];
  });

  it("refuses anyone who isn't an admin", async () => {
    state.isAdmin = false;
    expect(await render()).toContain("Not authorized.");
  });

  it("lists the conversations and flags the ones waiting for a person", async () => {
    const html = await render();
    expect(html).toContain("m@example.com");
    expect(html).toContain("Needs you");
    expect(html).toContain("Waiting for a person: <span");
    expect(html).toContain("Pick a conversation.");
  });

  it("shows one conversation with a reply box and the hand-back button", async () => {
    const html = await render(USER);
    expect(html).toContain("我想找真人");
    expect(html).toContain("Handed to the team");
    expect(html).toContain("Send reply");
    expect(html).toContain("Done: back to the assistant");
    expect(html).toContain(`value="${USER}"`);
  });

  it("escapes what members and staff wrote", async () => {
    const html = await render(USER);
    expect(html).not.toContain("<b>hi</b>");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });

  it("ignores a ?user= that isn't a member id", async () => {
    const html = await render("'; drop table x; --");
    expect(html).toContain("Pick a conversation.");
  });
});
