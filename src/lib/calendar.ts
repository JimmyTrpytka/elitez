/**
 * Přidání eventu do kalendáře: soubor .ics (Apple, Android, Outlook)
 * a odkaz do Google Kalendáře. Časy se ukládají v UTC.
 */
export type CalendarEvent = {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  description?: string | null;
  url: string;
};

/** 2027-05-01T08:00:00Z → 20270501T080000Z */
export function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapování textu podle RFC 5545 (zpětné lomítko, čárka, středník, nový řádek). */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
}

/** Dlouhé řádky se lámou po 75 bajtech (pokračování začíná mezerou). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    const next = current + ch;
    if (new TextEncoder().encode(next).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current = next;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(e: CalendarEvent, now = new Date()): string {
  const description = [e.description?.slice(0, 1000), e.url].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ELITEZ//Events//CS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@elitezclub.eu`,
    `DTSTAMP:${icsDate(now.toISOString())}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(e.endsAt)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.startsAt)}/${icsDate(e.endsAt)}`,
    details: [e.description?.slice(0, 500), e.url].filter(Boolean).join("\n\n"),
    ...(e.location ? { location: e.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
