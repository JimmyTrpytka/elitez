import { describe, expect, it } from "vitest";
import { registrationWindow, type RegistrationEventFields } from "./registration-window";

const base: RegistrationEventFields = {
  status: "published",
  access: "public",
  starts_at: "2027-06-19T08:00:00Z",
  registration_opens_at: "2027-03-01T09:00:00Z",
  registration_verified_opens_at: "2027-02-22T09:00:00Z", // týden předstih
  registration_closes_at: "2027-05-31T21:59:00Z",
};

const at = (iso: string) => new Date(iso);

describe("okno registrace", () => {
  it("před otevřením: běžný člen čeká, Verified už může", () => {
    const now = at("2027-02-25T12:00:00Z");
    const member = registrationWindow(base, false, now);
    expect(member.kind).toBe("not_open_yet");
    if (member.kind === "not_open_yet") {
      expect(member.opensAt).toBe(base.registration_opens_at);
      expect(member.verifiedOpensAt).toBe(base.registration_verified_opens_at);
    }
    expect(registrationWindow(base, true, now).kind).toBe("open");
  });

  it("otevřeno pro všechny", () => {
    expect(registrationWindow(base, false, at("2027-04-01T12:00:00Z")).kind).toBe("open");
  });

  it("po uzávěrce a po začátku eventu je zavřeno", () => {
    expect(registrationWindow(base, true, at("2027-06-01T12:00:00Z")).kind).toBe("closed");
    const noDeadline = { ...base, registration_closes_at: null };
    expect(registrationWindow(noDeadline, true, at("2027-06-19T09:00:00Z")).kind).toBe("closed");
  });

  it("stav a přístup eventu mají přednost", () => {
    const now = at("2027-04-01T12:00:00Z");
    expect(registrationWindow({ ...base, status: "cancelled" }, true, now).kind).toBe("cancelled");
    expect(registrationWindow({ ...base, status: "closed" }, true, now).kind).toBe("closed");
    expect(registrationWindow({ ...base, access: "invite_only" }, true, now).kind).toBe("invite_only");
    expect(registrationWindow({ ...base, access: "verified_only" }, false, now).kind).toBe("verified_only");
    expect(registrationWindow({ ...base, access: "verified_only" }, true, now).kind).toBe("open");
  });

  it("bez nastaveného otevření", () => {
    expect(
      registrationWindow({ ...base, registration_opens_at: null }, false, at("2027-04-01T12:00:00Z")).kind,
    ).toBe("not_set");
  });
});
