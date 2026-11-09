import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n/client";
import { MESSAGES } from "@/i18n/messages";
import type { Locale } from "@/i18n/config";
import { VslPlayer, VslTour } from "./VslPlayer";

const html = (ui: React.ReactNode, locale: Locale = "en") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </I18nProvider>
  );

describe("VslPlayer", () => {
  it("draws a cover and holds no video until play is pressed", () => {
    const out = html(<VslPlayer video="your-float" />);
    expect(out).toContain("How Market Makers is paid");
    expect(out).toContain("1 min");
    expect(out).not.toContain("<video");
    expect(out).not.toContain(".mp4");
  });

  it("is named once, by what it does, not by every line on the cover", () => {
    const out = html(<VslPlayer video="your-float" />);
    expect(out).toContain('aria-label="Play the video: How Market Makers is paid"');
    expect(out).not.toContain("sr-only");
  });

  it("is a phone-shaped cover on a phone and wide from sm up", () => {
    expect(html(<VslPlayer video="news" />)).toContain("aspect-[4/5]");
    expect(html(<VslPlayer video="news" />)).toContain("sm:aspect-video");
  });

  it("says the video is in English in the other languages", () => {
    expect(html(<VslPlayer video="news" />, "ms")).toContain("1 minit · dalam bahasa Inggeris");
    expect(html(<VslPlayer video="news" />, "zh-Hans")).toContain("1 分钟 · 英文视频");
  });

  it("takes the page's own eyebrow when it has one", () => {
    expect(html(<VslPlayer video="ai-trading-assistant" eyebrow="See it read an account" />)).toContain("See it read an account");
  });
});

describe("VslTour", () => {
  it("is one quiet button per video, and still no video", () => {
    const out = html(<VslTour videos={[{ video: "strategies" }, { video: "backtest", label: "How a backtest works" }]} />);
    expect(out).toContain("Watch the 1-minute tour");
    expect(out).toContain("How a backtest works");
    expect(out.match(/<button/g)).toHaveLength(2);
    expect(out).not.toContain("<video");
  });

  it("is named by its visible words first, then by which video (label in name)", () => {
    const out = html(<VslTour videos={[{ video: "strategies" }, { video: "backtest", label: "How a backtest works" }]} />);
    expect(out).toContain('aria-label="Watch the 1-minute tour: MM Strategies in one minute"');
    expect(out).toContain('aria-label="How a backtest works: Backtest a strategy on your own window"');
    expect(html(<VslTour videos={[{ video: "signals" }]} />, "zh-Hans")).toMatch(/aria-label="[^"]+：[^"]+"/);
  });
});
