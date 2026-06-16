"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Internal routes a bot iframe is allowed to ask the shell to navigate to.
// Keep in sync with the KYS app's config/routing.ts ROUTES.
const ALLOWED = new Set([
  "/course",
  "/strategies",
  "/library",
  "/live-classes",
  "/daily-analysis",
  "/calendar",
  "/bots/fundamental",
  "/signals",
  "/indicators",
  "/news",
  "/dashboard",
  "/upgrade",
]);

// Listens for `{ source: 'mmfx-kys', type: 'navigate', path }` messages posted
// by the embedded bot iframe and performs SPA navigation. Hardened: only the
// exact bot origin is trusted, and only allowlisted internal paths are honored.
export function BotNav({ origin }: { origin: string }) {
  const router = useRouter();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      const data = event.data as { source?: string; type?: string; path?: string } | null;
      if (!data || data.source !== "mmfx-kys" || data.type !== "navigate") return;
      if (typeof data.path !== "string" || !ALLOWED.has(data.path)) return;
      router.push(data.path);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, router]);

  return null;
}
