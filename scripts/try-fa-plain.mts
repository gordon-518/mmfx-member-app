// Dry-run "In plain words" against the live desk without saving anything:
//   npx tsx --env-file=.env.local --conditions=react-server scripts/try-fa-plain.mts XAUUSD zh-Hans
import { deskInstrument } from "../src/lib/fa/types";
import { generatePlain } from "../src/lib/fa/plain";
import { assetName } from "../src/lib/fa/glossary/match";
import type { Locale } from "../src/i18n/config";

const [id = "XAUUSD", locale = "en"] = process.argv.slice(2) as [string, Locale];
const instrument = deskInstrument(id)!;
const res = await fetch(`https://api.marketmakersfx.net/api/analysis?instrument=${id}`);
const { analysis } = await res.json();
const t0 = Date.now();
const out = await generatePlain({ analysis, instrument, assetName: assetName(instrument, instrument.nickname), locale });
console.log(`${id} ${locale} in ${((Date.now() - t0) / 1000).toFixed(1)}s via ${out.model}${out.error ? ` ERROR ${out.error}` : ""}`);
console.log(JSON.stringify(out.plain, null, 2));
