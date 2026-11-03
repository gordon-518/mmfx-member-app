import type { Country } from "@/lib/countries";

/**
 * Country names in the reader's language, from the platform's own Intl data
 * rather than a hand-translated list of 200 names. Falls back to the English
 * name if the runtime can't name a code. Sorted for that language, so a
 * Chinese reader finds 马来西亚 where they'd expect it.
 */
export function localisedCountries(countries: Country[], intlLocale: string): Country[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([intlLocale], { type: "region" });
  } catch {
    names = null;
  }
  return countries
    .map((c) => ({ code: c.code, name: names?.of(c.code) ?? c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, intlLocale));
}
