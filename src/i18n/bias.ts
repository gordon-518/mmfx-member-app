import type { Messages } from "./messages/types";

/** The desk's bias ("bullish" / "bearish" / "neutral") in the reader's language. */
export function biasWord(t: Messages, bias: string): string {
  if (bias === "bullish") return t.dashboard.bullish;
  if (bias === "bearish") return t.dashboard.bearish;
  return t.dashboard.neutral;
}
