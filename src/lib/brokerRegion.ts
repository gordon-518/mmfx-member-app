// Geo-routing for the broker funnel (see memory mmfx-broker-funnel): US/UK go to
// the contact (lifetime plans) path, a fixed list of countries to Dupoin, and
// everyone else, including unknown, to Octa/Elev8. Shared by /upgrade and the
// support agent's fact sheet.

export type Region = "octa" | "dupoin" | "contact";

// Dupoin countries: Canada, the EU/EEA member states, Iran, Israel, Japan,
// Myanmar, New Zealand, North Korea, the Philippines, Singapore.
export const DUPOIN_COUNTRIES: ReadonlySet<string> = new Set<string>([
  "CA", // Canada
  // EU member states
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA (non-EU) member states
  "IS", "LI", "NO",
  "IR", // Iran
  "IL", // Israel
  "JP", // Japan
  "MM", // Myanmar
  "NZ", // New Zealand
  "KP", // North Korea
  "PH", // The Philippines
  "SG", // Singapore
]);

export function regionFor(country: string): Region {
  if (country === "US" || country === "GB") return "contact";
  if (DUPOIN_COUNTRIES.has(country)) return "dupoin";
  return "octa";
}
