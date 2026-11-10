import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import type { EventView } from "@/lib/data/events";
import { EventAccessBadge } from "./status-badge";

export async function EventCard({ event }: { event: EventView }) {
  const [t, tCat, locale] = await Promise.all([
    getTranslations("Events"),
    getTranslations("EventCategory"),
    getLocale(),
  ]);
  return (
    <Link
      href={`/e/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-card bg-muted transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-ink">
        {event.cover.md ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover.md}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold tracking-[0.2em] text-white/80">
            ELITEZ
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {event.status === "cancelled" ? (
            <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
              {t("cancelled")}
            </span>
          ) : null}
          <EventAccessBadge access={event.access} />
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm font-semibold text-ink-soft">
          {formatEventDates(event.starts_at, event.ends_at, locale, event.timezone)}
        </p>
        <p className="mt-1 text-xl font-semibold text-ink">{event.title}</p>
        <p className="mt-1 text-sm text-subtle">
          {[event.venue_name, tCat(event.category)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
