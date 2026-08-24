"use client";

import Script from "next/script";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

// hCaptcha, invisible mode — no checkbox shown to real users; it only
// challenges when hCaptcha's own risk score is suspicious. Vanilla script
// integration (no @hcaptcha/react-hcaptcha dependency) to match this repo's
// minimal-dependency convention (see the hand-rolled journal SVG charts).
//
// If NEXT_PUBLIC_HCAPTCHA_SITE_KEY isn't set (local dev, or before the key is
// provisioned), execute() resolves with an empty token and signup proceeds
// without captcha enforcement — Supabase only requires a token once
// security_captcha_enabled is turned on server-side, so this stays safe to
// ship ahead of that flip.

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement,
        opts: { sitekey: string; size: "invisible"; callback: (token: string) => void }
      ) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

export interface CaptchaHandle {
  /** Runs the challenge and resolves with a fresh token (or "" if unconfigured). */
  getToken: () => Promise<string>;
  /** Call after a failed submit — hCaptcha tokens are single-use. */
  reset: () => void;
}

const SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "";

export const Captcha = forwardRef<CaptchaHandle>(function Captcha(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const pending = useRef<((token: string) => void) | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    getToken: () =>
      new Promise<string>((resolve) => {
        if (!SITE_KEY || !window.hcaptcha || widgetId.current == null) {
          resolve("");
          return;
        }
        pending.current = resolve;
        window.hcaptcha.execute(widgetId.current);
      }),
    reset: () => {
      if (window.hcaptcha && widgetId.current != null) {
        window.hcaptcha.reset(widgetId.current);
      }
    },
  }));

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://js.hcaptcha.com/1/api.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div
        ref={(el) => {
          containerRef.current = el;
          if (el && ready && window.hcaptcha && widgetId.current == null) {
            widgetId.current = window.hcaptcha.render(el, {
              sitekey: SITE_KEY,
              size: "invisible",
              callback: (token) => {
                pending.current?.(token);
                pending.current = null;
              },
            });
          }
        }}
      />
    </>
  );
});
