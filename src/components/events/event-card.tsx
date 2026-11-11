import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatEventDates } from "@/lib/dates";
import type { EventView } from "@/lib/data/events";
import { cn } from "@/lib/cn";

/** Den a měsíc pro „štítek“ s datem, např. 19 / ČVN. */
function dateParts(iso: string, locale: string, tz: string) {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(locale, { timeZone: tz, day: "numeric" }).format(d),
    month: new Intl.DateTimeFormat(locale, { timeZone: tz, month: "short" })
      .format(d)
      .replace(".", "")
      .toUpperCase(),
  };
}

/**
 * Karta eventu ve „výkladním“ stylu: velká fotka přes celou kartu,
 * žlutý štítek s datem, název velkým písmem přes ztmavený spodek.
 */
export async function EventCard({
  event,
  size = "md",
  className,
}: {
  event: EventView;
  size?: "md" | "lg";
  /** Přepsání poměru stran / výšky (např. v rozvržení úvodní stránky) */
  className?: string;
}) {
  const [t, tCat, tAccess, locale] = await Promise.all([
    getTranslations("Events"),
    getTranslations("EventCategory"),
    getTranslations("EventAccess"),
    getLocale(),
  ]);
  const { day, month } = dateParts(event.starts_at, locale, event.timezone);
  const cover = size === "lg" ? (event.cover.lg ?? event.cover.md) : event.cover.md;

  return (
    <Link
      href={`/e/${event.slug}`}
      className={cn(
        "group relative flex overflow-hidden rounded-card bg-night-soft ring-1 ring-white/10 transition-all duration-500",
        "hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgb(255_214_10/0.35)] hover:ring-accent/40",
        size === "lg" ? "aspect-[4/5] sm:aspect-[16/10]" : "aspect-[4/5]",
        className,
      )}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="glow-accent absolute inset-0 flex items-center justify-center">
          <span className="font-display text-5xl font-extrabold tracking-[0.2em] text-white/15">
            ELITEZ
          </span>
        </div>
      )}
      {/* Ztmavení spodku kvůli čitelnosti textu */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      <div className="absolute top-4 left-4 flex flex-col items-center rounded-control bg-accent px-3 py-2 leading-none text-ink">
        <span className="font-display text-3xl font-extrabold">{day}</span>
        <span className="mt-0.5 text-[11px] font-bold tracking-[0.15em]">{month}</span>
      </div>
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
        {event.status === "cancelled" ? (
          <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white">
            {t("cancelled")}
          </span>
        ) : null}
        {event.access !== "public" ? (
          <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {tAccess(event.access)}
          </span>
        ) : null}
      </div>

      <div className="relative mt-auto w-full p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
          {tCat(event.category)}
        </p>
        <h3
          className={cn(
            "mt-1 font-display leading-[0.95] font-extrabold text-white uppercase",
            size === "lg" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl",
          )}
        >
          {event.title}
        </h3>
        <p className="mt-2 text-sm text-white/75">
          {formatEventDates(event.starts_at, event.ends_at, locale, event.timezone)}
          {event.venue_name ? ` · ${event.venue_name}` : ""}
        </p>
      </div>
    </Link>
  );
}
