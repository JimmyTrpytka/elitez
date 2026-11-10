/** Země pro výběr v profilu a u vozidla (ISO kódy). ČR, SK, PL jsou nahoře. */
export const PRIORITY_COUNTRIES = ["CZ", "SK", "PL"] as const;

export const OTHER_EUROPEAN_COUNTRIES = [
  "AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "DE", "DK", "EE",
  "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT",
  "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PT", "RO", "RS",
  "SE", "SI", "SM", "TR", "UA", "VA", "XK",
] as const;

const ALL = new Set<string>([...PRIORITY_COUNTRIES, ...OTHER_EUROPEAN_COUNTRIES]);

export function isSupportedCountry(code: string): boolean {
  return ALL.has(code);
}

/** Název země v daném jazyce (např. CZ → „Česko“ / „Czechia“). */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export type CountryOption = { code: string; name: string };

/** Seznam pro výběr: nejdřív ČR/SK/PL, pak ostatní podle abecedy. */
export function countryOptions(locale: string): {
  priority: CountryOption[];
  other: CountryOption[];
} {
  const toOption = (code: string) => ({ code, name: countryName(code, locale) });
  return {
    priority: PRIORITY_COUNTRIES.map(toOption),
    other: OTHER_EUROPEAN_COUNTRIES.map(toOption).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    ),
  };
}
