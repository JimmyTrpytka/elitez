import { describe, expect, it } from "vitest";
import { guessLanguage, needsTranslation } from "./language";

describe("guessLanguage", () => {
  it("recognizes Czech by diacritics", () => {
    expect(guessLanguage("Sraz tuningových aut v Ostravě")).toBe("cs");
  });
  it("recognizes English", () => {
    expect(guessLanguage("The biggest meet of the year for all car fans and their friends")).toBe("en");
  });
  it("recognizes Czech without diacritics", () => {
    expect(guessLanguage("Je to sraz pro auta a lidi, co je baví")).toBe("cs");
  });
  it("is unsure about short names", () => {
    expect(guessLanguage("BMW M3 E30")).toBe("unknown");
  });
});

describe("needsTranslation", () => {
  it("skips Czech text for Czech readers", () => {
    expect(needsTranslation("Přijeď s autem, bude to jízda!", "cs")).toBe(false);
  });
  it("translates Czech text for English readers", () => {
    expect(needsTranslation("Přijeď s autem, bude to jízda!", "en")).toBe(true);
  });
  it("Czech car description with technical words is Czech", () => {
    const text = "Seat Leon ST Cupra 5F s motorem 2.0 TSI 4Drive s výkonem 300 koní.";
    expect(guessLanguage(text)).toBe("cs");
    expect(needsTranslation(text, "cs")).toBe(false);
  });
  it("does not offer translation for short names and slogans", () => {
    expect(needsTranslation("LOWER UNITED 🖤", "cs")).toBe(false);
    expect(needsTranslation("BMW M3 E30 Turbo", "en")).toBe(false);
  });
  it("still offers translation for longer unknown-language text", () => {
    expect(needsTranslation("Wir treffen uns jeden Samstag mit unseren Autos am Parkplatz", "cs")).toBe(true);
  });
  it("skips empty text", () => {
    expect(needsTranslation("   ", "en")).toBe(false);
  });
});
