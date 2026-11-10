import { describe, expect, it } from "vitest";
import {
  emptyToNull,
  hpToKw,
  isValidUsername,
  normalizeUsername,
  parseIntInRange,
} from "./validation";

describe("uživatelské jméno", () => {
  it("převede na malá písmena a odstraní @", () => {
    expect(normalizeUsername("  @Jimmy.E30 ")).toBe("jimmy.e30");
  });
  it("přijme platná jména", () => {
    expect(isValidUsername("jimmy_e30")).toBe(true);
    expect(isValidUsername("abc")).toBe(true);
  });
  it("odmítne neplatná jména", () => {
    expect(isValidUsername("ab")).toBe(false); // krátké
    expect(isValidUsername("a".repeat(31))).toBe(false); // dlouhé
    expect(isValidUsername("jméno")).toBe(false); // diakritika
    expect(isValidUsername("jim my")).toBe(false); // mezera
  });
});

describe("pomocné převody", () => {
  it("přepočte koně na kW", () => {
    expect(hpToKw(100)).toBe(74);
    expect(hpToKw(286)).toBe(210);
  });
  it("prázdný text je null", () => {
    expect(emptyToNull("   ")).toBeNull();
    expect(emptyToNull(" Praha ")).toBe("Praha");
  });
  it("kontroluje čísla v rozsahu", () => {
    expect(parseIntInRange("", 1, 10)).toBeNull();
    expect(parseIntInRange("5", 1, 10)).toBe(5);
    expect(parseIntInRange("11", 1, 10)).toBeUndefined();
    expect(parseIntInRange("abc", 1, 10)).toBeUndefined();
  });
});
