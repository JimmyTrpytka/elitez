import { getLocale, getTranslations } from "next-intl/server";
import { googleCalendarUrl } from "@/lib/calendar";
import { buttonClasses } from "@/components/ui/button";
import { CalendarIcon } from "@/components/icons";

/** „Do kalendáře“: rozbalovací nabídka – Apple/Android/Outlook (.ics) nebo Google. */
export async function AddToCalendar({
  event,
}: {
  event: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    starts_at: string;
    ends_at: string;
    venue_name: string | null;
    venue_address: string | null;
  };
}) {
  const [t, locale] = await Promise.all([getTranslations("Calendar"), getLocale()]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.elitezclub.eu").replace(/\/+$/, "");
  const google = googleCalendarUrl({
    uid: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(", ") || null,
    description: event.description,
    url: `${site}/${locale}/e/${event.slug}`,
  });
  const item =
    "block rounded-control px-4 py-3 text-sm font-semibold text-ink hover:bg-muted";

  return (
    <details className="group relative">
      <summary className={buttonClasses("outlineDark", "md", "cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden")}>
        <CalendarIcon className="h-5 w-5" />
        {t("add")}
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-64 rounded-card bg-white p-2 shadow-2xl">
        <a href={`/api/events/${event.slug}/calendar?locale=${locale}`} className={item}>
          {t("ics")}
          <span className="block text-xs font-normal text-subtle">{t("icsHint")}</span>
        </a>
        <a href={google} target="_blank" rel="noopener noreferrer" className={item}>
          {t("google")}
        </a>
      </div>
    </details>
  );
}
