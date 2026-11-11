import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import type { EventView } from "@/lib/data/events";
import {
  getMyRegistrationsForEvent,
  getRegistrationFormContext,
} from "@/lib/data/registrations";
import { registrationWindow } from "@/lib/registration-window";
import { RegistrationStatusBadge } from "./status-badge";
import { buttonClasses } from "@/components/ui/button";

/** Box „Registrace“ na detailu eventu – podle stavu eventu a uživatele. */
export async function RegistrationBox({ event }: { event: EventView }) {
  const [t, locale, ctx] = await Promise.all([
    getTranslations("Registration"),
    getLocale(),
    getRegistrationFormContext(),
  ]);
  const mine = ctx ? await getMyRegistrationsForEvent(event.id) : [];
  const win = registrationWindow(event, ctx?.isVerified ?? false);
  const fmt = (iso: string) => formatDateTime(iso, locale, event.timezone);

  let headline: string;
  let detail: string | null = null;
  let action: React.ReactNode = null;

  switch (win.kind) {
    case "open":
      headline = t("open");
      detail = win.closesAt ? t("openUntil", { date: fmt(win.closesAt) }) : null;
      action = ctx ? (
        <Link href={`/e/${event.slug}/register`} className={buttonClasses("primary", "lg")}>
          {mine.length ? t("registerAnother") : t("register")}
        </Link>
      ) : (
        <Link
          href={{ pathname: "/login", query: { next: `/${locale}/e/${event.slug}/register` } }}
          className={buttonClasses("primary", "lg")}
        >
          {t("loginToRegister")}
        </Link>
      );
      break;
    case "not_open_yet":
      headline = t("opensAt", { date: fmt(win.opensAt) });
      detail = win.verifiedOpensAt
        ? t("verifiedEarlier", { date: fmt(win.verifiedOpensAt) })
        : null;
      break;
    case "verified_only":
      headline = t("verifiedOnly");
      detail = t("verifiedOnlyText");
      break;
    case "invite_only":
      headline = t("inviteOnly");
      break;
    case "not_set":
      headline = t("notSet");
      break;
    case "cancelled":
      headline = t("eventCancelled");
      break;
    default:
      headline = t("closed");
  }

  return (
    <div className="mb-12 flex flex-col gap-4 rounded-card bg-muted p-6">
      <div>
        <p className="text-lg font-semibold text-ink">{headline}</p>
        {detail ? <p className="mt-1 text-sm text-ink-soft">{detail}</p> : null}
        {win.kind === "open" && event.capacity ? (
          <p className="mt-1 text-sm text-ink-soft">{t("capacityNote", { count: event.capacity })}</p>
        ) : null}
      </div>
      {mine.length ? (
        <ul className="flex flex-col gap-2">
          {mine.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface px-4 py-3"
            >
              <span className="font-semibold text-ink">
                {r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : "—"}
              </span>
              <RegistrationStatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {action}
        {mine.length ? (
          <Link href="/account/registrations" className={buttonClasses("ghost", "lg")}>
            {t("myRegistrations")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
