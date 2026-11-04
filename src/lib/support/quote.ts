// Shared by both assistants' alerts to the team (Telegram and email).

/** A dot between two letters or digits — ASCII or full-width — in any script. */
const DOT = /(?<=[\p{L}\p{N}])[.。．｡․](?=[\p{L}\p{N}])/gu;

/**
 * Member (and model) text made safe to put in front of the team: one line,
 * no control characters, and nothing a client can still turn into a link —
 * http(s) becomes "hxxps://", any other scheme "tg[:]//", and every dot
 * between two letters or digits is bracketed ("sub[.]evil[.]co[.]uk",
 * "192[.]168[.]1[.]10"), whatever punctuation follows. Cut on whole
 * characters, so an emoji at the limit can't leave half a surrogate pair
 * for Telegram to reject.
 */
export function quoteForAlert(text: string, max: number): string {
  const flat = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  const cut = chars.length > max ? `${chars.slice(0, max).join("")}…` : flat;
  return cut
    .replace(/\bhttp(s?):\/\//gi, "hxxp$1://")
    .replace(/\b(?!hxxps?:\/\/)([a-z][a-z0-9+.-]*):\/\//gi, "$1[:]//")
    .replace(DOT, "[.]");
}
