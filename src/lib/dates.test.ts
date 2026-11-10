import { describe, expect, it } from "vitest";
import { formatEventDates, utcToZonedLocal, zonedLocalToUtc } from "./dates";
import { eventSlug, isValidSlug, slugify } from "./slug";

describe("pražský čas ↔ UTC", () => {
  it("letní čas (+2 h)", () => {
    expect(zonedLocalToUtc("2027-05-15T10:00")?.toISOString()).toBe(
      "2027-05-15T08:00:00.000Z",
    );
  });
  it("zimní čas (+1 h)", () => {
    expect(zonedLocalToUtc("2027-01-10T10:00")?.toISOString()).toBe(
      "2027-01-10T09:00:00.000Z",
    );
  });
  it("den změny času (28. 3. 2027)", () => {
    expect(zonedLocalToUtc("2027-03-28T12:00")?.toISOString()).toBe(
      "2027-03-28T10:00:00.000Z",
    );
  });
  it("tam a zpět dá stejnou hodnotu", () => {
    const utc = zonedLocalToUtc("2027-06-19T09:30")!;
    expect(utcToZonedLocal(utc.toISOString())).toBe("2027-06-19T09:30");
  });
  it("neplatný vstup", () => {
    expect(zonedLocalToUtc("15. 5. 2027")).toBeNull();
  });
  it("vícedenní termín", () => {
    expect(
      formatEventDates("2027-06-19T08:00:00Z", "2027-06-20T18:00:00Z", "cs"),
    ).toMatch(/19\.\s*[–-]\s*20\.\s*6\.\s*2027/);
    expect(formatEventDates("2027-05-15T08:00:00Z", "2027-05-15T20:00:00Z", "cs")).toBe(
      "15. 5. 2027",
    );
  });
});

describe("adresa eventu", () => {
  it("odstraní diakritiku a mezery", () => {
    expect(slugify("Tuning show Trojhalí")).toBe("tuning-show-trojhali");
    expect(slugify("  Underground   meeting #3 ")).toBe("underground-meeting-3");
  });
  it("přidá rok jen jednou", () => {
    expect(eventSlug("Underground meeting 3", 2027)).toBe("underground-meeting-3-2027");
    expect(eventSlug("Sraz 2027", 2027)).toBe("sraz-2027");
  });
  it("kontrola platnosti", () => {
    expect(isValidSlug("tuning-show-2027")).toBe(true);
    expect(isValidSlug("Tuning Show")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
  });
});
