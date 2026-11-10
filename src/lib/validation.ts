/** Společná pravidla pro formuláře (musí odpovídat kontrolám v databázi). */

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
export const COUNTRY_PATTERN = /^[A-Z]{2}$/;

export const LIMITS = {
  displayName: 60,
  city: 80,
  bio: 500,
  make: 60,
  model: 80,
  engine: 120,
  description: 2000,
  story: 5000,
  modDescription: 300,
  photosPerVehicle: 20,
} as const;

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

/** Přepočet koní na kW (1 k = 0,7355 kW), zaokrouhleno. */
export function hpToKw(hp: number): number {
  return Math.round(hp * 0.7355);
}

/** Prázdný text → null, jinak oříznutý text. */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Celé číslo v rozsahu, prázdné → null, nesmysl → undefined (= chyba). */
export function parseIntInRange(
  value: string,
  min: number,
  max: number,
): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return n >= min && n <= max ? n : undefined;
}
