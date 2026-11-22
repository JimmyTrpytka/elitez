import { describe, expect, it } from "vitest";
import { cardRegistrationBadge } from "./registration-window";

const now = new Date("2026-11-22T12:00:00Z");
const base = {
  status: "published" as const,
  access: "public" as const,
  starts_at: "2026-12-04T09:00:00Z",
  registration_opens_at: "2026-11-20T09:00:00Z",
  registration_verified_opens_at: null,
  registration_closes_at: null,
  capacity: 20 as number | null,
};

describe("štítek registrace na kartě eventu", () => {
  it("otevřená registrace s volnými místy", () => {
    expect(cardRegistrationBadge(base, 5, now)).toEqual({ kind: "open" });
  });
  it("poslední místa (≤ 10 % kapacity, nejméně 2)", () => {
    expect(cardRegistrationBadge(base, 18, now)).toEqual({ kind: "last", left: 2 });
    expect(cardRegistrationBadge({ ...base, capacity: 5 }, 3, now)).toEqual({ kind: "last", left: 2 });
  });
  it("plno = čekací listina", () => {
    expect(cardRegistrationBadge(base, 20, now)).toEqual({ kind: "full" });
  });
  it("bez kapacity jen „otevřená“", () => {
    expect(cardRegistrationBadge({ ...base, capacity: null }, null, now)).toEqual({ kind: "open" });
  });
  it("před otevřením ukáže datum", () => {
    expect(cardRegistrationBadge({ ...base, registration_opens_at: "2026-11-25T09:00:00Z" }, 0, now)).toEqual({
      kind: "soon",
      opensAt: "2026-11-25T09:00:00Z",
    });
  });
  it("po uzávěrce, u zrušeného a bez nastavené registrace nic", () => {
    expect(cardRegistrationBadge({ ...base, registration_closes_at: "2026-11-21T09:00:00Z" }, 0, now)).toBeNull();
    expect(cardRegistrationBadge({ ...base, status: "cancelled" }, 0, now)).toBeNull();
    expect(cardRegistrationBadge({ ...base, registration_opens_at: null }, 0, now)).toBeNull();
  });
});
