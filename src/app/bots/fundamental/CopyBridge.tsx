"use client";

import { useEffect } from "react";

// Bridges the Fundamental Desk iframe's "Send me a copy" button to our mailer.
// Mirrors BotNav: only the exact desk origin is trusted. On a valid message we
// POST the instrument to our route, then post the result back into the desk
// frame so it can show ✓/✗.
export function CopyBridge({ origin }: { origin: string }) {
  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      const data = event.data as
        | { source?: string; type?: string; instrument?: string }
        | null;
      if (!data || data.source !== "mmfx-kys" || data.type !== "send-copy") return;

      const frame = event.source as Window | null;

      let ok = false;
      let reason: string | undefined;
      try {
        const res = await fetch("/api/fundamental/send-copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrument: data.instrument }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          reason?: string;
        };
        ok = res.ok && json?.ok === true;
        reason = json?.reason;
      } catch {
        ok = false;
        reason = "network_error";
      }

      // Reply only to the desk frame, scoped to the desk origin.
      frame?.postMessage(
        { source: "mmfx-app", type: "send-copy:result", ok, reason },
        origin
      );
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);

  return null;
}
