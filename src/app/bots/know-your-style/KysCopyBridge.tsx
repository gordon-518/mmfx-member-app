"use client";

import { useEffect } from "react";

// Bridges the Know Your Style iframe's "Send me a copy" button to our mailer.
// Mirrors BotNav/CopyBridge: only the exact KYS origin is trusted. The result
// HTML is built by KYS and posted up; we relay it to our server route (which
// emails the LOGGED-IN user) and post the outcome back into the KYS frame.
export function KysCopyBridge({ origin }: { origin: string }) {
  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      const data = event.data as
        | { source?: string; type?: string; archetype?: string; resultHtml?: string }
        | null;
      if (
        !data ||
        data.source !== "mmfx-kys" ||
        data.type !== "send-copy-kys" ||
        typeof data.archetype !== "string" ||
        typeof data.resultHtml !== "string"
      ) {
        return;
      }

      const frame = event.source as Window | null;

      let ok = false;
      let reason: string | undefined;
      try {
        const res = await fetch("/api/kys/send-copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            archetype: data.archetype,
            resultHtml: data.resultHtml,
          }),
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

      // Reply only to the KYS frame, scoped to the KYS origin.
      frame?.postMessage(
        { source: "mmfx-app", type: "send-copy-kys:result", ok, reason },
        origin
      );
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);

  return null;
}
