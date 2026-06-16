"use client";

import { useEffect, useRef } from "react";

// This week's high-impact, USD/gold-moving events — free TradingView events
// embed (no backend). Medium + high importance, USD-focused.
export function EconomicCalendar() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.querySelector("script")) return; // guard StrictMode double-run
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: "light",
      isTransparent: true,
      width: "100%",
      height: "420",
      locale: "en",
      importanceFilter: "0,1",
      countryFilter: "us,eu,gb",
    });
    el.appendChild(script);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card p-1 shadow-soft">
      <div className="tradingview-widget-container" ref={ref}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}
