import { describe, it, expect } from "vitest";
import { FEATURE_KEYS } from "@/lib/access/featureKeys";
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { FEATURE_VSL, VSL_KEYS, vslSources } from "./vsl";

describe("feature videos", () => {
  it("plays both cuts from the public vsl bucket, under a versioned path", () => {
    const src = vslSources("your-float", "https://proj.supabase.co/");
    expect(src.wide).toBe("https://proj.supabase.co/storage/v1/object/public/vsl/v1/your-float-16x9.mp4");
    expect(src.tall).toBe("https://proj.supabase.co/storage/v1/object/public/vsl/v1/your-float-4x5.mp4");
  });

  it("maps features only to videos that exist", () => {
    for (const [feature, video] of Object.entries(FEATURE_VSL)) {
      expect(FEATURE_KEYS, feature).toContain(feature);
      expect(VSL_KEYS, feature).toContain(video);
    }
  });

  it("has a title for every video in every language, and says English where the page isn't", () => {
    for (const locale of LOCALES) {
      const v = MESSAGES[locale].vsl;
      for (const key of VSL_KEYS) expect(v.titles[key].trim(), `${locale} ${key}`).not.toBe("");
      if (locale !== "en") expect(v.inEnglish, locale).not.toBe("");
    }
  });
});
