import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("adds https", () => {
    expect(normalizeUrl("instagram.com/elitez")).toBe("https://instagram.com/elitez");
  });
  it("keeps full urls", () => {
    expect(normalizeUrl("http://example.cz/a")).toBe("http://example.cz/a");
  });
  it("empty is null", () => {
    expect(normalizeUrl("  ")).toBeNull();
  });
  it("rejects nonsense", () => {
    expect(normalizeUrl("ahoj")).toBeUndefined();
    expect(normalizeUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeUrl("moje stranka.cz")).toBeUndefined();
  });
});
