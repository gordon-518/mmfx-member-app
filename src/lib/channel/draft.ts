import "server-only";
import type { LibraryKind } from "@/lib/channel/types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Marketing copy quality matters here, so use a stronger model than the
// growth-narrative Haiku.
const MODEL = "claude-sonnet-5";

export interface Draft { kind: LibraryKind; body: string; }

/** A proven post, with the numbers that prove it — fed back to seed new copy. */
export interface Winner {
  body: string;
  feature: string;
  impressions: number;
  clicks: number;
  reactions: number;
}

const SYSTEM = [
  "You write short educational/mindset and light-CTA posts for MarketMakersFX,",
  "a gold (XAU/USD) trading education + broker-IB brand, for its Telegram channel.",
  "House voice: disciplined, calm, no hype. Start the first line with the ⚜️ mark.",
  "House markdown only: **bold**, __italic__, `code`. Each post 40–90 words.",
  "COMPLIANCE — NEVER: promise or guarantee returns; mention broker payouts,",
  "per-lot rebates, IB numbers/links, or any 'no fee' claim; give financial advice.",
  "CTA posts may invite a free 7-day trial at app.marketmakersfx.net framed as",
  "'the whole desk, free to try'. Educational posts end on a discipline line.",
].join(" ");

// Ask Claude for N drafts as a JSON array. Optional `examples` are our current
// best-performing posts — the model is told to write more in that spirit, which
// is how the self-optimizing loop feeds winners back into new copy.
// Best-effort: any failure → [].
export async function draftLibraryPosts(n: number, examples: Winner[] = []): Promise<Draft[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];

  // Give the model the evidence, not just the text: knowing a post earned a
  // 40% click rate promoting the AI assistant is far more instructive than
  // being told, without context, that it "did well".
  const winners = examples.length
    ? `\n\nThese posts have measurably outperformed. Study what they have in common —
the angle, the sentence rhythm, the specificity — and write new posts in that
spirit. Do NOT copy them or restate them; write fresh copy that works for the
same reason.\n` +
      examples
        .map((e, i) => {
          const ctr = e.impressions > 0 ? Math.round((e.clicks / e.impressions) * 100) : 0;
          return `${i + 1}. [promotes: ${e.feature} · ${e.impressions} posts · ${e.clicks} clicks (${ctr}%) · ${e.reactions} reactions]\n${e.body}`;
        })
        .join("\n\n")
    : "";

  const prompt =
    `Write ${n} distinct posts. Rotate themes across: trading discipline, risk ` +
    `management, trading psychology, self-research over social noise, and a soft ` +
    `free-trial CTA. Return ONLY a JSON array like ` +
    `[{"kind":"educational"|"cta","body":"..."}] with no surrounding prose.${winners}`;

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const text: string = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("")
      : "";
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr)
      ? arr
          .filter((d) => d && typeof d.body === "string")
          .map((d) => ({ kind: d.kind === "cta" ? "cta" : "educational", body: d.body as string }))
      : [];
  } catch {
    return [];
  }
}
