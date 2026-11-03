import type { Locale } from "../config";
import type { Messages } from "./types";
import { en } from "./en";
import { zhHans } from "./zh-Hans";
import { zhHant } from "./zh-Hant";
import { ms } from "./ms";
import { id } from "./id";

// Every locale must fill the whole Messages shape — a missing key is a type
// error, not a blank in production.
export const MESSAGES: Record<Locale, Messages> = {
  en,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  ms,
  id,
};
