"use client";

import { useEffect, useRef } from "react";

// Live market ticker — free TradingView ticker-tape embed (no backend). Gold
// front and centre, plus the dollar and the pairs a gold trader watches.
const SYMBOLS = [
  { proName: "OANDA:XAUUSD", title: "Gold" },
  { proName: "CAPITALCOM:DXY", title: "Dollar (DXY)" },
  { proName: "FX:EURUSD", title: "EUR/USD" },
  { proName: "FX:GBPUSD", title: "GBP/USD" },
  { proName: "TVC:USOIL", title: "Oil" },
  { proName: "BITSTAMP:BTCUSD", title: "BTC" },
];

export function MarketBar() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.querySelector("script")) return; // guard StrictMode double-run
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: SYMBOLS,
      colorTheme: "light",
      isTransparent: true,
      showSymbolLogo: true,
      displayMode: "adaptive",
      locale: "en",
    });
    el.appendChild(script);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      <div className="tradingview-widget-container" ref={ref}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}
