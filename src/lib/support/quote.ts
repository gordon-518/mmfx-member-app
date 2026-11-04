// Shared by both assistants' alerts to the team (Telegram and email).

/**
 * Member (and model) text made safe to put in front of the team: one line,
 * no control characters, and links defused ("hxxps://evil[.]example"), so a
 * message can't plant a convincing link right above the real "Reply" one.
 */
export function quoteForAlert(text: string, max: number): string {
  const flat = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  const cut = flat.length > max ? `${flat.slice(0, max)}…` : flat;
  return cut
    .replace(/\bhttp(s?):\/\//gi, "hxxp$1://")
    .replace(/\b([a-z0-9-]+)\.([a-z]{2,})(?=[\/\s:?#]|$)/gi, "$1[.]$2");
}
