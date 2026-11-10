import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import type { EventRow } from "@/lib/data/events";
import { EventAccessBadge, EventStatusBadge } from "@/components/events/status-badge";

/** Přehled eventů pro pořadatele (název, termín, stav). */
export async function OrganizerEventList({ events }: { events: EventRow[] }) {
  const [t, locale] = await Promise.all([getTranslations("Organizer"), getLocale()]);
  if (events.length === 0) return <p className="text-ink-soft">{t("noEvents")}</p>;
  return (
    <ul className="divide-y divide-line rounded-control border border-line">
      {events.map((e) => (
        <li key={e.id}>
          <Link
            href={`/organizer/events/${e.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted"
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
        </li>
      ))}
    </ul>
  );
}
