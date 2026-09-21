import { describe, it } from "vitest";
import fs from "node:fs";
import { buildFactSheet } from "@/lib/support/facts";
import { checkDraft, mustHandOff } from "@/lib/support/guard";
import { decide } from "@/lib/support/agent";
import { adminDb } from "@/lib/channel/db";
import type { SupportSettings, ThreadMessage } from "@/lib/support/types";

// Dry run of the real pipeline (facts -> Claude -> guard) over historical
// member questions. Nothing is ever sent: sendpulse.ts is never imported, and
// no chat state is written. Opt-in only, so `npm test` never spends credit:
//
//   SUPPORT_REPLAY=1 SUPPORT_REPLAY_FILE=<questions.jsonl> SUPPORT_REPLAY_OUT=<dir> \
//     npx vitest run scripts/support-replay.test.ts
//
// The input holds real member text and stays outside the repo; decide() runs
// it through redactForModel before it reaches the model, and the report is
// written to SUPPORT_REPLAY_OUT (a scratchpad), never committed.
const RUN = process.env.SUPPORT_REPLAY === "1";
const SAMPLE = Number(process.env.SUPPORT_REPLAY_N ?? 200);

describe.skipIf(!RUN)("support replay", () => {
  it("runs the pipeline over historical questions", async () => {
    process.loadEnvFile?.(".env.local");
    const { data } = await adminDb().from("support_settings").select("*").eq("id", 1).single();
    const facts = buildFactSheet(data as SupportSettings);

    type Case = { q: string; thread: { d: number; t: string; flow: boolean; at: string | null }[] };
    const all = fs.readFileSync(process.env.SUPPORT_REPLAY_FILE!, "utf8").trim().split("\n")
      .map((l) => JSON.parse(l) as Case)
      .filter((p) => p.q && !/^\[[^\]]*\]$/.test(p.q));
    // Deterministic shuffle so a re-run covers the same questions.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sample = [...all].sort(() => rnd() - 0.5).slice(0, SAMPLE);

    type Row = { q: string; outcome: string; topic?: string; confidence?: number; reply?: string; reason?: string; guard?: string[] };
    const rows: Row[] = [];
    let calls = 0;
    for (const [i, p] of sample.entries()) {
      const q = String(p.q);
      // The real thread the agent would see: everything up to and including
      // the member's question, flow messages marked as such.
      const thread: ThreadMessage[] = (p.thread ?? []).map((m, j) => ({
        id: `${i}-${j}`, direction: m.d === 1 ? "in" as const : "out" as const,
        fromFlow: Boolean(m.flow), text: m.t, at: m.at ?? new Date().toISOString(),
      }));
      const contact = { id: "replay", username: null, firstName: "", isBusiness: false, tags: [] };
      const ctx = { facts, memberTexts: thread.filter((m) => m.direction === "in").map((m) => m.text), member: null };

      // Same order as run.ts: the always-human rules fire before any model call.
      const hard = mustHandOff(q, "other");
      if (hard) { rows.push({ q, outcome: "handoff", reason: hard }); continue; }

      calls++;
      const first = await decide({ facts, thread, contact, member: null });
      const d = first.decision;
      if (!d) { rows.push({ q, outcome: "handoff", reason: first.refused ? "refused" : `error ${first.error ?? ""}` }); continue; }
      if (d.action === "handoff" || d.confidence < 0.7 || mustHandOff(q, d.topic)) {
        rows.push({ q, outcome: "handoff", topic: d.topic, confidence: d.confidence, reason: d.reason });
        continue;
      }
      let fails = checkDraft(d.reply, ctx);
      let reply = d.reply;
      if (fails.length) {
        calls++;
        const second = await decide({ facts, thread, contact, member: null, retryReasons: fails });
        const s = second.decision;
        if (s && s.action === "reply" && !checkDraft(s.reply, ctx).length) { reply = s.reply; fails = []; }
      }
      rows.push(fails.length
        ? { q, outcome: "handoff", topic: d.topic, reason: "guard", guard: fails }
        : { q, outcome: "reply", topic: d.topic, confidence: d.confidence, reply });
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${sample.length} (${calls} model calls)`);
    }

    const out = process.env.SUPPORT_REPLAY_OUT!;
    fs.writeFileSync(`${out}/support-replay.json`, JSON.stringify(rows, null, 2));
    const n = (o: string) => rows.filter((r) => r.outcome === o).length;
    const byTopic = new Map<string, number>();
    for (const r of rows) if (r.topic) byTopic.set(r.topic, (byTopic.get(r.topic) ?? 0) + 1);
    const md = [
      `# Support agent replay (${rows.length} questions, ${calls} model calls)`,
      "",
      `Replies: ${n("reply")} · Handoffs: ${n("handoff")} · Guard-blocked: ${rows.filter((r) => r.reason === "guard").length}`,
      "",
      `Topics: ${[...byTopic.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} ${c}`).join(" · ")}`,
      "",
      "| Question | Outcome | Reply / reason |", "|---|---|---|",
      ...rows.map((r) => `| ${r.q.replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 100)} | ${r.outcome}${r.topic ? ` (${r.topic})` : ""} | ${(r.reply ?? r.guard?.join("; ") ?? r.reason ?? "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 200)} |`),
    ].join("\n");
    fs.writeFileSync(`${out}/support-replay.md`, md);
    console.log(md.split("\n").slice(0, 5).join("\n"));
  }, 60 * 60_000);
});
