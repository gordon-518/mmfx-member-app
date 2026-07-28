import { escapeHtml } from "@/lib/telegram";

// MMFX house-markdown → Telegram HTML. Escape first (so user text can't inject
// tags), then wrap the three house tokens. Telegram's HTML mode supports
// <b>/<i>/<code>/<a>; it does NOT understand **/__, hence this conversion.
export function houseMarkdownToHtml(src: string): string {
  let out = escapeHtml(src);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/__([^_]+)__/g, "<i>$1</i>");
  return out;
}
