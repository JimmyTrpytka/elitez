import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { escapeHtml, fillPlaceholders, renderEmail } from "./render";

const payload = {
  name: "Honza",
  event_title: "Tuning show Trojhalí",
  event_slug: "tuning-show-trojhali-2027",
  event_starts_at: "2027-06-19T08:00:00Z",
  event_ends_at: "2027-06-20T16:00:00Z",
  event_timezone: "Europe/Prague",
  vehicle: "BMW E30",
};

describe("e-maily", () => {
  it("schválení česky obsahuje jméno, auto, termín a odkaz", () => {
    const mail = renderEmail("registration_approved", "cs", payload);
    expect(mail.subject).toBe("Jsi přijat(a) – Tuning show Trojhalí");
    expect(mail.text).toContain("Ahoj Honza");
    expect(mail.text).toContain("BMW E30");
    expect(mail.text).toContain("19.–20. 6. 2027");
    expect(mail.html).toContain("/cs/e/tuning-show-trojhali-2027");
  });

  it("anglická verze", () => {
    const mail = renderEmail("registration_waitlist", "en", payload);
    expect(mail.subject).toBe("Waitlist – Tuning show Trojhalí");
    expect(mail.html).toContain('lang="en"');
  });

  it("zamítnutí obsahuje důvod a zprávu pořadatele", () => {
    const mail = renderEmail("registration_rejected", "cs", {
      ...payload,
      reason: "criteria",
      message: "Letos hlavně americká auta.",
    });
    expect(mail.text).toContain("Důvod: Vozidlo nesplňuje kritéria selekce");
    expect(mail.text).toContain("Letos hlavně americká auta.");
  });

  it("text od uživatelů je escapovaný (žádné vložené HTML)", () => {
    const mail = renderEmail("broadcast", "cs", {
      ...payload,
      subject: "Info",
      body: "Ahoj {jmeno}, <script>alert(1)</script>",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Ahoj Honza, &lt;script&gt;");
    expect(escapeHtml('"a" & <b>')).toBe("&quot;a&quot; &amp; &lt;b&gt;");
  });

  it("doplní {jmeno} a {event}", () => {
    expect(fillPlaceholders("Ahoj {jmeno} na {event}", "Eva", "Sraz")).toBe("Ahoj Eva na Sraz");
  });
});
