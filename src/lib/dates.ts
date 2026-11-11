/**
 * Práce s časem eventů. V databázi je čas v UTC, pořadatel ho zadává
 * a návštěvník vidí v časové zóně eventu (zatím vždy Europe/Prague).
 */
export const DEFAULT_EVENT_TZ = "Europe/Prague";

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** O kolik ms je čas v zóně `tz` napřed oproti UTC v daném okamžiku. */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** „2027-05-15T10:00“ v zóně tz → okamžik (Date v UTC). Neplatný vstup → null. */
export function zonedLocalToUtc(local: string, tz: string = DEFAULT_EVENT_TZ): Date | null {
  const m = LOCAL_PATTERN.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMs(new Date(guess), tz);
  let result = guess - offset;
  // Kolem změny letního času se posun může lišit – druhý průchod to dorovná
  const offset2 = tzOffsetMs(new Date(result), tz);
  if (offset2 !== offset) result = guess - offset2;
  return new Date(result);
}

/** Okamžik → „2027-05-15T10:00“ v zóně tz (pro pole typu datetime-local). */
export function utcToZonedLocal(
  iso: string | null | undefined,
  tz: string = DEFAULT_EVENT_TZ,
): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Datum a čas pro zobrazení, např. „15. 5. 2027 10:00“. */
export function formatDateTime(iso: string, locale: string, tz: string = DEFAULT_EVENT_TZ) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Termín eventu, např. „19.–20. 6. 2027“ nebo „15. 5. 2027“. */
export function formatEventDates(
  startsAt: string,
  endsAt: string,
  locale: string,
  tz: string = DEFAULT_EVENT_TZ,
): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (fmt.format(start) === fmt.format(end)) return fmt.format(start);

  const partsOf = (d: Date) => {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(d);
    const get = (t: string) => p.find((x) => x.type === t)?.value;
    return { y: get("year"), m: get("month"), d: get("day") };
  };
  const s = partsOf(start);
  const e = partsOf(end);
  // Česky stejný měsíc zkráceně: „19.–20. 6. 2027“
  if (locale.startsWith("cs") && s.y === e.y && s.m === e.m) {
    return `${s.d}.–${fmt.format(end)}`;
  }
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** Jen čas, např. „10:00“. */
export function formatTime(iso: string, locale: string, tz: string = DEFAULT_EVENT_TZ) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Už skončilo? (porovnání s aktuálním časem serveru) */
export function hasEnded(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}
