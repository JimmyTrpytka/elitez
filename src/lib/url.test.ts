import { describe, expect, it } from "vitest";
import { normalizeSocial, normalizeUrl } from "./url";

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

describe("normalizeSocial", () => {
  it("builds links from handles", () => {
    expect(normalizeSocial("instagram", "@elitez")).toBe("https://www.instagram.com/elitez");
    expect(normalizeSocial("tiktok", "elitez.club")).toBe("https://www.tiktok.com/@elitez.club");
    expect(normalizeSocial("youtube", "@ElitezCZ")).toBe("https://www.youtube.com/@ElitezCZ");
  });
  it("keeps full links", () => {
    expect(normalizeSocial("facebook", "facebook.com/elitez")).toBe("https://facebook.com/elitez");
  });
  it("website needs a real address", () => {
    expect(normalizeSocial("website", "elitez")).toBeUndefined();
    expect(normalizeSocial("website", "elitezclub.eu")).toBe("https://elitezclub.eu/");
  });
  it("empty is null", () => {
    expect(normalizeSocial("instagram", " ")).toBeNull();
  });
});
