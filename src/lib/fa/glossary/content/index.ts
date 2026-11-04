import type { Locale } from "@/i18n/config";
import type { GlossaryContent } from "../types";
import { glossaryEn } from "./en";
import { glossaryZhHans } from "./zh-Hans";
import { glossaryZhHant } from "./zh-Hant";
import { glossaryMs } from "./ms";
import { glossaryId } from "./id";

export const GLOSSARY: Record<Locale, GlossaryContent> = {
  en: glossaryEn,
  "zh-Hans": glossaryZhHans,
  "zh-Hant": glossaryZhHant,
  ms: glossaryMs,
  id: glossaryId,
};
