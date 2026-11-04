"use client";

import { useEffect, useState } from "react";

export interface PlainLabels {
  title: string;
  meta: string;
  whatHappened: string;
  deskView: string;
  whatChanges: string;
  loading: string;
  note: string;
}

interface Plain {
  what_happened: string;
  desk_view: string;
  what_changes: string;
}

type State = { kind: "loading" } | { kind: "ready"; plain: Plain } | { kind: "failed" };

// The thesis retold in plain words, in the member's language. The first reader
// of a new thesis waits while it's written; everyone after gets the saved copy.

export function PlainEnglish({ instrument, labels }: { instrument: string; labels: PlainLabels }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/fundamental/plain?instrument=${encodeURIComponent(instrument)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((j: { ok?: boolean; plain?: Plain }) => setState(j.ok && j.plain ? { kind: "ready", plain: j.plain } : { kind: "failed" }))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setState({ kind: "failed" });
      });
    return () => controller.abort();
  }, [instrument]);

  if (state.kind === "failed") {
    return null;
  }

  const rows: [string, keyof Plain][] = [
    [labels.whatHappened, "what_happened"],
    [labels.deskView, "desk_view"],
    [labels.whatChanges, "what_changes"],
  ];

  return (
    <section
      aria-busy={state.kind === "loading"}
      className="rise rounded-2xl border border-orange/30 bg-card p-5 shadow-soft"
      style={{ animationDelay: "0.22s" }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[17px] font-bold tracking-tight text-ink">{labels.title}</h2>
        <span className="text-[12px] text-faint">{labels.meta}</span>
      </header>

      {state.kind === "loading" ? (
        <div className="mt-4 space-y-2.5">
          <p className="text-[13px] text-subtle">{labels.loading}</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 animate-pulse rounded-full bg-line" style={{ width: `${92 - i * 14}%` }} />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map(([label, field]) => (
            <div key={field}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-orange">{label}</h3>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink">{state.plain[field]}</p>
            </div>
          ))}
          <p className="text-[11.5px] leading-relaxed text-faint">{labels.note}</p>
        </div>
      )}
    </section>
  );
}
