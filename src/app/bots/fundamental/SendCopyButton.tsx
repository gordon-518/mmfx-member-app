"use client";

import { useState } from "react";

// "Send me a copy" — the desk's PDF, emailed to the signed-in account. The
// route derives the recipient from the session, so nothing but the instrument
// is ever sent. (This replaces the postMessage bridge the iframe needed.)

const REASONS: Record<string, string> = {
  unauthorized: "Your session expired — sign in again and retry.",
  bad_instrument: "That instrument isn't on the desk.",
  pdf_unavailable: "The desk couldn't produce the report just now. Try again shortly.",
  send_failed: "The email didn't go out. Try again shortly.",
};

export function SendCopyButton({ instrument }: { instrument: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

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
        setMessage("Sent — check your inbox.");
        return;
      }
      setStatus("error");
      setMessage(REASONS[json.reason ?? ""] ?? "Something went wrong. Try again shortly.");
    } catch {
      setStatus("error");
      setMessage("Network error — check your connection and try again.");
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
        {status === "sending" ? "Sending…" : status === "sent" ? "Sent" : "Send me a copy"}
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
