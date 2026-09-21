// Telegram formatting for the agent's replies.
//
// SendPulse's /telegram/contacts/send only renders markup when the message
// carries parse_mode: "HTML" (verified against the live API — without it the
// tags arrive as literal text). Telegram then REJECTS malformed HTML, so we
// never hand the model's output straight to it: a stray "<" in a member's
// name or a half-written tag would fail the send and cost the member a reply.
//
// Instead the model writes plain text with two markers it can't get wrong —
// **bold** and _italic_ — and this module escapes everything first, then
// converts only those markers. Whatever comes out is valid HTML by
// construction.

const ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

/** Telegram HTML for a plain-text draft. Escapes first, then converts markers. */
export function toTelegramHtml(text: string): string {
  const escaped = text.replace(/[&<>]/g, (c) => ESCAPE[c]);
  return escaped
    // **bold** — non-greedy, no line breaks inside, so an unpaired ** is left alone.
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    // _italic_ — needs a boundary either side so snake_case handles and
    // usernames like @MM_3000 or file_name.ts are never italicised.
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,!?;:)]|$)/g, "$1<i>$2</i>");
}

/** The plain-text form, for logging and for length checks. */
export function stripMarkers(text: string): string {
  return text.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,!?;:)]|$)/g, "$1$2");
}
