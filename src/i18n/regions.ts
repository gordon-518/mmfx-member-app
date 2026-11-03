import type { Country } from "@/lib/countries";

/**
 * Country names in the reader's language, from the platform's own Intl data
 * rather than a hand-translated list of 200 names. English keeps our own list
 * ("Hong Kong", not Intl's "Hong Kong SAR China"), and so does any code the
 * runtime can't name. Sorted for that language, so a Chinese reader finds
 * 马来西亚 where they'd expect it.
 */
export function localisedCountries(countries: Country[], intlLocale: string): Country[] {
  if (intlLocale.startsWith("en")) return countries;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([intlLocale], { type: "region" });
  } catch {
    names = null;
  }
  return countries
    .map((c) => {
      const named = names?.of(c.code);
      return { code: c.code, name: named && named !== c.code ? named : c.name };
    })
    .sort((a, b) => a.name.localeCompare(b.name, intlLocale));
}
