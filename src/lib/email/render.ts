import { createTranslator } from "next-intl";
import cs from "@/i18n/messages/cs.json";
import en from "@/i18n/messages/en.json";
import { formatEventDates } from "@/lib/dates";
import { fillPlaceholders } from "./placeholders";

export { fillPlaceholders };

/**
 * Šablony e-mailů (texty jsou v překladech, jmenný prostor „Email“).
 * Vše, co zadal uživatel (zpráva pořadatele, název eventu, jméno), se escapuje.
 */
export type EmailTemplate =
  | "registration_received"
  | "registration_approved"
  | "registration_rejected"
  | "registration_waitlist"
  | "registration_promoted"
  | "broadcast"
  | "feedback";

export type EmailPayload = {
  name?: string | null;
  event_title?: string;
  event_slug?: string;
  event_starts_at?: string;
  event_ends_at?: string;
  event_timezone?: string;
  vehicle?: string | null;
  reason?: string | null;
  message?: string | null;
  subject?: string;
  body?: string;
  page?: string;
  from?: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const MESSAGES = { cs, en } as const;
type EmailLocale = keyof typeof MESSAGES;

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3a3a3c">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}


function layout(opts: {
  locale: EmailLocale;
  heading: string;
  bodyHtml: string;
  button?: { label: string; url: string };
  footer: string;
}): string {
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:#ffd60a;border-radius:999px"><a href="${escapeHtml(opts.button.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#0a0a0a;text-decoration:none">${escapeHtml(opts.button.label)}</a></td></tr></table>`
    : "";
  return `<!doctype html>
<html lang="${opts.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px">
<tr><td style="padding:28px 32px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ffd60a;margin-right:8px"></span><span style="font-size:16px;font-weight:700;letter-spacing:0.2em;color:#0a0a0a">ELITEZ</span></td></tr>
<tr><td style="padding:24px 32px 8px"><h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;color:#0a0a0a">${escapeHtml(opts.heading)}</h1>${opts.bodyHtml}${button}</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid #e5e5ea;font-size:13px;line-height:1.5;color:#6e6e73">${escapeHtml(opts.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderEmail(
  template: EmailTemplate,
  localeValue: string,
  payload: EmailPayload,
): RenderedEmail {
  const locale: EmailLocale = localeValue === "en" ? "en" : "cs";
  const messages = MESSAGES[locale];
  const t = createTranslator({ locale, messages, namespace: "Email" });
  const tReason = createTranslator({ locale, messages, namespace: "RejectionReason" });

  const site = siteUrl();
  const name = payload.name?.trim() || t("defaultName");
  const eventTitle = payload.event_title ?? "";
  const when =
    payload.event_starts_at && payload.event_ends_at
      ? formatEventDates(
          payload.event_starts_at,
          payload.event_ends_at,
          locale,
          payload.event_timezone ?? undefined,
        )
      : "";
  const eventUrl = payload.event_slug ? `${site}/${locale}/e/${payload.event_slug}` : site;
  const myUrl = `${site}/${locale}/account/registrations`;
  const vehicle = payload.vehicle ?? "";
  const vars = { name, event: eventTitle, when, vehicle };

  let subject: string;
  let heading: string;
  let text: string;
  let button = { label: t("buttonMyRegistrations"), url: myUrl };

  switch (template) {
    case "registration_received":
      subject = t("received.subject", { event: eventTitle });
      heading = t("received.heading");
      text = t("received.body", vars);
      break;
    case "registration_approved":
      subject = t("approved.subject", { event: eventTitle });
      heading = t("approved.heading");
      text = t("approved.body", vars);
      button = { label: t("buttonEvent"), url: eventUrl };
      break;
    case "registration_promoted":
      subject = t("promoted.subject", { event: eventTitle });
      heading = t("promoted.heading");
      text = t("promoted.body", vars);
      button = { label: t("buttonEvent"), url: eventUrl };
      break;
    case "registration_waitlist":
      subject = t("waitlist.subject", { event: eventTitle });
      heading = t("waitlist.heading");
      text = t("waitlist.body", vars);
      break;
    case "registration_rejected": {
      const reasonKey = (["capacity", "criteria", "incomplete", "other"] as const).find(
        (r) => r === payload.reason,
      );
      subject = t("rejected.subject", { event: eventTitle });
      heading = t("rejected.heading");
      text = t("rejected.body", vars);
      text += `\n\n${t("rejected.reason")}: ${tReason(reasonKey ?? "other")}`;
      if (payload.message) text += `\n\n${payload.message}`;
      break;
    }
    case "feedback":
      subject = t("feedback.subject");
      heading = t("feedback.heading");
      text = `${t("feedback.from")}: ${payload.from ?? "—"}\n${t("feedback.page")}: ${payload.page || "—"}\n\n${payload.message ?? ""}`;
      button = { label: t("feedback.button"), url: `${site}/${locale}/admin/feedback` };
      break;
    case "broadcast":
      subject = `${payload.subject ?? ""} – ${eventTitle}`;
      heading = payload.subject ?? eventTitle;
      text = fillPlaceholders(payload.body ?? "", name, eventTitle);
      button = { label: t("buttonEvent"), url: eventUrl };
      break;
  }

  const footer = t("footer");
  return {
    subject,
    html: layout({ locale, heading, bodyHtml: paragraphs(text), button, footer }),
    text: `${heading}\n\n${text}\n\n${button.label}: ${button.url}\n\n—\n${footer}`,
  };
}
