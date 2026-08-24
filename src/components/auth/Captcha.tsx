"use client";

import Script from "next/script";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// hCaptcha, invisible mode — no checkbox shown to real users; it only
// challenges when hCaptcha's own risk score is suspicious. Vanilla script
// integration (no @hcaptcha/react-hcaptcha dependency) to match this repo's
// minimal-dependency convention (see the hand-rolled journal SVG charts).
//
// If NEXT_PUBLIC_HCAPTCHA_SITE_KEY isn't set (local dev, or before the key is
// provisioned), getToken() resolves with "" and the caller sends an empty
// captchaToken — safe as long as Supabase's security_captcha_enabled is also
// off; the two must be flipped together, never enabled server-side ahead of
// every form actually sending a token (see git history: enabling captcha
// project-wide broke login for ~15s before LoginForm/ForgotPasswordForm were
// wired up — Supabase enforces it on signup AND signin AND recover, not just
// whichever form you tested).
//
// Load sequencing: hCaptcha's own docs warn against calling render() as soon
// as the <script> tag's load event fires — its internal API isn't necessarily
// ready yet ("should not render before js api is fully loaded" console
// warning). The documented fix is `?onload=<globalFnName>&render=explicit` on
// the script URL, so hCaptcha itself tells us when it's truly ready. The
// global callback is registered at module scope (runs the instant this file
// is evaluated, before the <Script> tag can even be requested) and dispatches
// a DOM event so any mounted Captcha instance can pick it up regardless of
// exactly when its own effect runs relative to the script load.

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
    __hcaptchaOnLoad?: () => void;
  }
}

const READY_EVENT = "hcaptcha-ready";

if (typeof window !== "undefined" && !window.__hcaptchaOnLoad) {
  window.__hcaptchaOnLoad = () => window.dispatchEvent(new Event(READY_EVENT));
}

export interface CaptchaHandle {
  /** Runs the challenge and resolves with a fresh token (or "" if unconfigured/not-yet-ready). */
  getToken: () => Promise<string>;
  /** Call after a failed submit — hCaptcha tokens are single-use. */
  reset: () => void;
}

const SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "";

export const Captcha = forwardRef<CaptchaHandle>(function Captcha(_props, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const pending = useRef<((token: string) => void) | null>(null);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) return;
    if (window.hcaptcha) {
      setApiReady(true); // already loaded by an earlier page in this session
      return;
    }
    const onReady = () => setApiReady(true);
    window.addEventListener(READY_EVENT, onReady);
    return () => window.removeEventListener(READY_EVENT, onReady);
  }, []);

  // Render the widget exactly once, once hCaptcha itself confirms it's ready
  // AND the container div exists.
  useEffect(() => {
    if (!apiReady || !window.hcaptcha || !containerRef.current || widgetId.current != null) {
      return;
    }
    widgetId.current = window.hcaptcha.render(containerRef.current, {
      sitekey: SITE_KEY,
      size: "invisible",
      callback: (token) => {
        pending.current?.(token);
        pending.current = null;
      },
    });
  }, [apiReady]);

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
        src="https://js.hcaptcha.com/1/api.js?onload=__hcaptchaOnLoad&render=explicit"
        strategy="afterInteractive"
      />
      <div ref={containerRef} />
    </>
  );
});
