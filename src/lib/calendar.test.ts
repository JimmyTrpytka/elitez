import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, icsDate, icsEscape } from "./calendar";

const event = {
  uid: "abc",
  title: "Sraz; Ostrava, 2027",
  startsAt: "2027-05-01T08:00:00.000Z",
  endsAt: "2027-05-01T16:30:00.000Z",
  location: "Trojhalí, Ostrava",
  description: "Řádek 1\nŘádek 2",
  url: "https://www.elitezclub.eu/cs/e/sraz-2027",
};

describe("calendar", () => {
  it("formats UTC dates", () => {
    expect(icsDate("2027-05-01T08:00:00.000Z")).toBe("20270501T080000Z");
  });

  it("escapes special characters", () => {
    expect(icsEscape("a,b;c\nd\\e")).toBe("a\\,b\;c\\nd\\\\e");
  });

  it("builds a valid ICS event", () => {
    const ics = buildIcs(event, new Date("2026-11-12T10:00:00Z"));
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20270501T080000Z");
    expect(ics).toContain("DTEND:20270501T163000Z");
    expect(ics).toContain("SUMMARY:Sraz\; Ostrava\\, 2027");
    expect(ics).toContain("LOCATION:Trojhalí\\, Ostrava");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // žádný řádek delší než 75 bajtů
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("builds a Google Calendar link", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get("dates")).toBe("20270501T080000Z/20270501T163000Z");
    expect(url.searchParams.get("text")).toBe(event.title);
  });
});
