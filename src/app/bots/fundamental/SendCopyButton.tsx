"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import type { Messages } from "@/i18n/messages/types";

// "Send me a copy" — the desk's PDF, emailed to the signed-in account. The
// route derives the recipient from the session, so nothing but the instrument
// is ever sent. (This replaces the postMessage bridge the iframe needed.)

/** The route's failure reasons, mapped to their words (fundamental.send.*). */
const REASONS: Record<string, keyof Messages["fundamental"]["send"]> = {
  unauthorized: "unauthorized",
  bad_instrument: "badInstrument",
  pdf_unavailable: "pdfUnavailable",
  send_failed: "sendFailed",
};

export function SendCopyButton({ instrument }: { instrument: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const words = useT().fundamental.send;

  async function send() {
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/fundamental/send-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
      };
      if (res.ok && json.ok) {
        setStatus("sent");
        setMessage(words.sent);
        return;
      }
      setStatus("error");
      const reason = json.reason ?? "";
      setMessage(words[Object.hasOwn(REASONS, reason) ? REASONS[reason] : "generic"]);
    } catch {
      setStatus("error");
      setMessage(words.network);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={status === "sending"}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "sending" ? words.sending : status === "sent" ? words.sentButton : words.button}
      </button>
      {message && (
        <span
          role="status"
          className={`text-[13px] font-medium ${status === "error" ? "text-accent-ink" : "text-subtle"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
