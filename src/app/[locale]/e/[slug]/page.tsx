import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { formatDateTime, formatEventDates, formatTime } from "@/lib/dates";
import { getEventBySlug, getMyOrganizer } from "@/lib/data/events";
import { EventMap } from "@/components/events/event-map";
import { EventAccessBadge, EventStatusBadge } from "@/components/events/status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Events");
  return { title: t("detailMetaTitle") };
}

export default async function EventDetailPage({ params }: PageProps<"/[locale]/e/[slug]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-5xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <EventDetail params={params} />
    </Suspense>
  );
}

function TextBlock({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section className="mb-12">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <p className="max-w-3xl leading-relaxed whitespace-pre-line text-ink-soft">{text}</p>
    </section>
  );
}

async function EventDetail({ params }: { params: PageProps<"/[locale]/e/[slug]">["params"] }) {
  const { slug } = await params;
  const [t, tCat, locale, event, organizer] = await Promise.all([
    getTranslations("Events"),
    getTranslations("EventCategory"),
    getLocale(),
    getEventBySlug(decodeURIComponent(slug)),
    getMyOrganizer(),
  ]);
  // RLS: koncept a event na pozvánky vrátí databáze jen pořadateli
  if (!event) notFound();
  const isOrganizer = organizer?.id === event.organizer_id;

  const place = [
    event.venue_name,
    event.venue_address,
    event.country ? countryName(event.country, locale) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const navigateUrl =
    event.lat !== null && event.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`
      : null;

  const facts: Array<[string, string]> = [
    [t("when"), `${formatEventDates(event.starts_at, event.ends_at, locale, event.timezone)}, ${formatTime(event.starts_at, locale, event.timezone)}–${formatTime(event.ends_at, locale, event.timezone)}`],
    ...(place ? [[t("where"), place] as [string, string]] : []),
    [t("category"), tCat(event.category)],
    ...(event.capacity ? [[t("capacity"), t("capacityValue", { count: event.capacity })] as [string, string]] : []),
    ...(event.registration_opens_at
      ? [[t("registrationOpens"), formatDateTime(event.registration_opens_at, locale, event.timezone)] as [string, string]]
      : []),
    ...(event.registration_closes_at
      ? [[t("registrationCloses"), formatDateTime(event.registration_closes_at, locale, event.timezone)] as [string, string]]
      : []),
    ...(event.registration_verified_opens_at && event.verified_head_start_hours > 0
      ? [[t("verifiedOpens"), formatDateTime(event.registration_verified_opens_at, locale, event.timezone)] as [string, string]]
      : []),
  ];

  return (
    <article className="pb-20">
      {event.cover.lg ? (
        <div className="w-full bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover.lg}
            alt={event.title}
            className="mx-auto max-h-[70vh] w-full max-w-7xl object-cover"
          />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        {isOrganizer ? (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Link href={`/organizer/events/${event.id}`} className={buttonClasses("secondary")}>
              {t("manage")}
            </Link>
            <EventStatusBadge status={event.status} />
          </div>
        ) : null}

        {event.status === "cancelled" ? (
          <div className="mb-6">
            <Alert tone="error">{t("cancelledNotice")}</Alert>
          </div>
        ) : null}

        <header className="mb-10">
          <div className="mb-3 flex flex-wrap gap-2">
            <EventAccessBadge access={event.access} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{event.title}</h1>
          {event.organizerName ? (
            <p className="mt-3 text-ink-soft">
              {t("organizedBy", { name: event.organizerName })}
            </p>
          ) : null}
          {event.description ? (
            <p className="mt-6 max-w-3xl text-lg whitespace-pre-line text-ink-soft">
              {event.description}
            </p>
          ) : null}
        </header>

        <dl className="mb-12 grid gap-x-6 gap-y-5 border-y border-line py-6 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-subtle">{label}</dt>
              <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mb-12 rounded-card bg-muted p-6">
          <p className="font-semibold text-ink">{t("registrationSoonTitle")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("registrationSoonText")}</p>
        </div>

        <TextBlock title={t("program")} text={event.program} />
        <TextBlock title={t("selection")} text={event.selection_criteria} />
        <TextBlock title={t("rules")} text={event.rules} />

        {event.lat !== null && event.lng !== null ? (
          <section className="mb-12">
            <h2 className="mb-3 text-xl font-semibold">{t("mapTitle")}</h2>
            <EventMap lat={event.lat} lng={event.lng} label={t("mapTitle")} />
            {navigateUrl ? (
              <a
                href={navigateUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("primary", "md", "mt-4")}
              >
                {t("navigate")}
              </a>
            ) : null}
          </section>
        ) : null}
      </div>
    </article>
  );
}
