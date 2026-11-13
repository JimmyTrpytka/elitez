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
  it("skips empty text", () => {
    expect(needsTranslation("   ", "en")).toBe(false);
  });
});
