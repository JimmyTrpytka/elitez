export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;

/** „Tuning show Trojhalí 2027“ → „tuning-show-trojhali-2027“. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX - 6)
    .replace(/-+$/g, "");
}

/** Adresa eventu z názvu; rok se přidá, pokud už v názvu není. */
export function eventSlug(title: string, year: number): string {
  const base = slugify(title) || "event";
  return base.endsWith(String(year)) ? base : `${base}-${year}`;
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value.length <= SLUG_MAX;
}
