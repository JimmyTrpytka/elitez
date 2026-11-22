import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import type { EventRow } from "@/lib/data/events";
import { countPendingRegistrations } from "@/lib/data/registrations";
import { EventAccessBadge, EventStatusBadge } from "@/components/events/status-badge";

/** Přehled eventů pro pořadatele (název, termín, stav, rychlý odkaz na přihlášky). */
export async function OrganizerEventList({ events }: { events: EventRow[] }) {
  const [t, locale, pending] = await Promise.all([
    getTranslations("Organizer"),
    getLocale(),
    countPendingRegistrations(events.map((e) => e.id)),
  ]);
  if (events.length === 0) return <p className="text-ink-soft">{t("noEvents")}</p>;
  return (
    <ul className="divide-y divide-line rounded-control border border-line">
      {events.map((e) => {
        const count = pending[e.id] ?? 0;
        return (
          <li key={e.id} className="flex flex-wrap items-center gap-x-2 hover:bg-muted">
            <Link
              href={`/organizer/events/${e.id}`}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="min-w-0 flex-1 font-semibold text-ink">{e.title}</span>
              <span className="text-sm text-subtle">
                {formatEventDates(e.starts_at, e.ends_at, locale, e.timezone)}
              </span>
              <span className="flex gap-1.5">
                <EventAccessBadge access={e.access} />
                <EventStatusBadge status={e.status} />
              </span>
            </Link>
            {e.status !== "draft" ? (
              <Link
                href={`/organizer/events/${e.id}/registrations`}
                className="mx-4 mb-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:border-ink sm:mb-0 sm:ml-0"
              >
                {t("registrations")}
                {count > 0 ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">{count}</span>
                ) : null}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
