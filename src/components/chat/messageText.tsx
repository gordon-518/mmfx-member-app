import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// Renders a chat message: paragraphs and line breaks, **bold**, _italics_ and
// links — and nothing else. The text is never parsed as HTML, so a message
// can't inject markup. Links to the app itself open in place; anything else
// opens in a new tab.

const APP_ORIGIN = "https://app.marketmakersfx.net";
// A URL, **bold**, or _italics_ whose underscores aren't inside a word (so
// "@MM_3000" and "mmfx_academy" stay as they are).
const TOKEN = /(https?:\/\/[^\s<>()]+)|\*\*([^*\n]+)\*\*|(?<![\w])_([^_\n]+)_(?![\w])/g;
const TRAILING = /[.,!?;:'"]+$/;

function link(url: string, key: string): ReactNode {
  if (url.startsWith(`${APP_ORIGIN}/`)) {
    const path = url.slice(APP_ORIGIN.length);
    return (
      <Link key={key} href={path} className="font-semibold text-orange underline underline-offset-2">
        {path}
      </Link>
    );
  }
  return (
    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-orange underline underline-offset-2">
      {url}
    </a>
  );
}

export function inline(text: string, prefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${prefix}${i++}`;
    if (m[1]) {
      const tail = m[1].match(TRAILING)?.[0] ?? "";
      const url = tail ? m[1].slice(0, -tail.length) : m[1];
      out.push(link(url, key));
      if (tail) out.push(tail);
    } else if (m[2]) {
      out.push(<strong key={key} className="font-semibold">{m[2]}</strong>);
    } else if (m[3]) {
      out.push(<em key={key}>{m[3]}</em>);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MessageText({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((p, pi) => (
        <p key={pi} className={pi > 0 ? "mt-2" : undefined}>
          {p.split("\n").map((line, li) => (
            <Fragment key={li}>
              {li > 0 && <br />}
              {inline(line, `${pi}.${li}.`)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
