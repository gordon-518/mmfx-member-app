import { Fragment } from "react";
import { parseReportMarkdown, type Span } from "@/lib/kys/markdown";

// Renders the model's report as React elements (never raw HTML) in the app's
// own type scale. See lib/kys/markdown.ts for why we don't use react-markdown.

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => (
        <Fragment key={i}>{s.bold ? <strong className="font-semibold text-ink">{s.text}</strong> : s.text}</Fragment>
      ))}
    </>
  );
}

export function ReportMarkdown({ markdown }: { markdown: string }) {
  const blocks = parseReportMarkdown(markdown);
  return (
    <div className="space-y-3.5">
      {blocks.map((b, i) => {
        if (b.kind === "heading" && b.level === 2) {
          return (
            <h3
              key={i}
              className="flex items-center gap-2.5 border-b border-line pb-2 pt-4 font-display text-[17px] font-bold tracking-tight text-ink first:pt-0"
            >
              <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-[2px] bg-orange" />
              <Spans spans={b.spans} />
            </h3>
          );
        }
        if (b.kind === "heading") {
          return (
            <h4 key={i} className="pt-2 font-display text-[15px] font-bold text-accent-ink">
              <Spans spans={b.spans} />
            </h4>
          );
        }
        if (b.kind === "list") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-subtle marker:text-orange">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Spans spans={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[14.5px] leading-relaxed text-subtle">
            <Spans spans={b.spans} />
          </p>
        );
      })}
    </div>
  );
}
