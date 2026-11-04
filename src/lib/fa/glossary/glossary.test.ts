import { describe, it, expect } from "vitest";
import { LOCALES } from "@/i18n/config";
import { FA_INSTRUMENTS } from "../types";
import { adviceIn, moneyClaimIn } from "../compliance";
import { GLOSSARY } from "./content";
import { moveKeyFor, resolveTerm, segment, termsIn } from "./match";
import { MOVE_KEYS, TERMS, TERM_IDS } from "./terms";

const termTexts = (text: string) =>
  segment(text, "metal").flatMap((s) => (s.kind === "term" ? [`${s.id}:${s.text}`] : []));

describe("segment", () => {
  it("finds the desk's jargon and keeps the text around it", () => {
    const text = "Real yields at 2.62% argue bearish, but DXY crashed.";
    expect(segment(text, "metal").map((s) => s.text).join("")).toBe(text);
    expect(termTexts(text)).toEqual(["realYield:Real yields", "dxy:DXY"]);
  });

  it("prefers the longest match where terms overlap", () => {
    expect(termTexts("The US 10y real yield fell.")).toEqual(["realYield:US 10y real yield"]);
    expect(termTexts("The US 10y yield fell.")).toEqual(["treasuryYield:US 10y yield"]);
  });

  it("marks each term once per text", () => {
    expect(termTexts("Above the H4 50 EMA; the EMA held on H4.")).toEqual(["timeframe:H4", "ema:EMA"]);
  });

  it("respects word boundaries and acronym case", () => {
    expect(termTexts("The fed-up crowd confided in a federal clerk.")).toEqual([]);
    expect(termTexts("Prices are reset.")).toEqual([]);
  });

  it("only underlines scoped terms on their asset class", () => {
    expect(termsIn(["BTC dominance climbed"], "crypto")).toContain("btcDominance");
    expect(termsIn(["BTC dominance climbed"], "fx_major")).not.toContain("btcDominance");
  });
});

describe("moveKeyFor", () => {
  it("puts every instrument on the right side of the dollar", () => {
    const keys = Object.fromEntries(FA_INSTRUMENTS.map((i) => [i.id, moveKeyFor(i)]));
    expect(keys).toMatchObject({
      XAUUSD: "metal",
      XAGUSD: "metal",
      EURUSD: "fxUsdQuote",
      GBPUSD: "fxUsdQuote",
      AUDUSD: "fxUsdQuote",
      NZDUSD: "fxUsdQuote",
      USDJPY: "fxUsdBase",
      USDCHF: "fxUsdBase",
      USDCAD: "fxUsdBase",
      BTCUSD: "crypto",
      ETHUSD: "crypto",
    });
  });
});

describe("glossary content", () => {
  it.each(LOCALES)("%s: per-asset terms cover every move key, the rest are one sentence", (locale) => {
    for (const id of TERM_IDS) {
      const { moves } = GLOSSARY[locale][id];
      if (TERMS[id].perAsset) {
        expect(typeof moves, `${locale}.${id}`).toBe("object");
        for (const k of MOVE_KEYS) expect((moves as Record<string, string>)[k]?.trim(), `${locale}.${id}.${k}`).toBeTruthy();
      } else {
        expect(typeof moves, `${locale}.${id}`).toBe("string");
      }
    }
  });

  it.each(LOCALES)("%s: no money claims, advice or broken placeholders", (locale) => {
    for (const id of TERM_IDS) {
      for (const inst of FA_INSTRUMENTS) {
        const r = resolveTerm(GLOSSARY[locale], id, inst, inst.display);
        for (const text of [r.name, r.what, r.moves]) {
          expect(text.trim(), `${locale}.${id}`).toBeTruthy();
          expect(text, `${locale}.${id}`).not.toMatch(/[{}]/);
          expect(moneyClaimIn(text, locale), `${locale}.${id}: ${text}`).toBeNull();
          expect(adviceIn(text, locale), `${locale}.${id}: ${text}`).toBeNull();
        }
      }
    }
  });

  it("fills {asset} with the instrument", () => {
    const eur = FA_INSTRUMENTS.find((i) => i.id === "EURUSD")!;
    expect(resolveTerm(GLOSSARY.en, "dxy", eur, "EUR/USD").moves).toContain("pushes EUR/USD down");
  });
});

describe("compliance helpers", () => {
  it("lets yield vocabulary through but catches real claims", () => {
    expect(moneyClaimIn("实际收益率上升", "zh-Hans")).toBeNull();
    expect(moneyClaimIn("稳定收益", "zh-Hans")).toBe("收益");
    expect(moneyClaimIn("imbal hasil riil naik", "id")).toBeNull();
    expect(moneyClaimIn("cuan besar", "id")).toBe("cuan");
    expect(moneyClaimIn("steady returns", "en")).toBe("returns");
  });

  it("catches instructions to the reader, not descriptions", () => {
    expect(adviceIn("Buyers stepped in at support.", "en")).toBeNull();
    expect(adviceIn("You should buy here.", "en")).not.toBeNull();
    expect(adviceIn("建议买入黄金", "zh-Hans")).not.toBeNull();
  });
});
