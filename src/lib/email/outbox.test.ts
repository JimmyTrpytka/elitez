import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeFrom } from "./outbox";

describe("odesílatel e-mailů", () => {
  it("správný tvar zůstane", () => {
    expect(normalizeFrom("ELITEZ <noreply@elitezclub.eu>")).toBe("ELITEZ <noreply@elitezclub.eu>");
    expect(normalizeFrom("noreply@elitezclub.eu")).toBe("noreply@elitezclub.eu");
  });
  it("odstraní uvozovky a mezery", () => {
    expect(normalizeFrom('"ELITEZ <noreply@elitezclub.eu>"')).toBe("ELITEZ <noreply@elitezclub.eu>");
    expect(normalizeFrom('  "ELITEZ" < noreply@elitezclub.eu > ')).toBe("ELITEZ <noreply@elitezclub.eu>");
  });
  it("nesmysl odmítne", () => {
    expect(normalizeFrom("ELITEZ noreply")).toBeUndefined();
    expect(normalizeFrom(undefined)).toBeUndefined();
  });
});
