"use client";

import { useEffect, useRef } from "react";
import { useLocale, useT } from "@/i18n/client";
import type { Locale } from "@/i18n/config";

// TradingView ships its widgets in these languages itself, so the ticker can
// follow the member's language rather than staying English.
const TV_LOCALE: Record<Locale, string> = {
  en: "en",
  "zh-Hans": "zh_CN",
  "zh-Hant": "zh_TW",
  ms: "ms_MY",
  id: "id",
};

// Live market ticker — free TradingView ticker-tape embed (no backend). Gold
// front and centre, plus the dollar and the pairs a gold trader watches.
function symbols(t: ReturnType<typeof useT>) {
  return [
    { proName: "OANDA:XAUUSD", title: t.dashboard.tickerGold },
    { proName: "CAPITALCOM:DXY", title: t.dashboard.tickerDollar },
    { proName: "FX:EURUSD", title: "EUR/USD" },
    { proName: "FX:GBPUSD", title: "GBP/USD" },
    { proName: "TVC:USOIL", title: t.dashboard.tickerOil },
    { proName: "BITSTAMP:BTCUSD", title: "BTC" },
  ];
}

export function MarketBar() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    const el = ref.current;
    if (!el || el.querySelector("script")) return; // guard StrictMode double-run
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: symbols(t),
      colorTheme: "light",
      isTransparent: true,
      showSymbolLogo: true,
      displayMode: "adaptive",
      locale: TV_LOCALE[locale],
    });
    el.appendChild(script);
    // The dashboard remounts this per locale (key={locale}), so the widget is
    // built once per language and the script guard above stays correct.
  }, [t, locale]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      <div className="tradingview-widget-container" ref={ref}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}
