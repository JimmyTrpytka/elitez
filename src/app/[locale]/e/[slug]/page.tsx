import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { formatDateTime, formatEventDates, formatTime } from "@/lib/dates";
import { getEventBySlug, getMyOrganizer } from "@/lib/data/events";
import { EventMap } from "@/components/events/event-map";
import { RegistrationBox } from "@/components/registrations/registration-box";
import { EventAccessBadge, EventStatusBadge } from "@/components/events/status-badge";
import { Alert } from "@/components/ui/alert";
import { DisplayHeading } from "@/components/brand";
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
      <h2 className="mb-4 font-display text-3xl font-extrabold text-white uppercase">{title}</h2>
      <p className="max-w-3xl leading-relaxed whitespace-pre-line text-white/75">{text}</p>
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
    <article className="flex-1 bg-night pb-20 text-night-text">
      {/* Úvodní fotka s názvem */}
      <header className="relative overflow-hidden">
        {event.cover.lg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover.lg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        ) : null}
        <div aria-hidden className="glow-accent absolute inset-0" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night via-night/60 to-night/10" />
        <div className="relative mx-auto flex min-h-[56svh] w-full max-w-5xl flex-col justify-end px-4 pt-24 pb-10 sm:min-h-[64svh] sm:px-6">
          <div className="reveal mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold tracking-[0.12em] text-ink uppercase">
              {formatEventDates(event.starts_at, event.ends_at, locale, event.timezone)}
            </span>
            <EventAccessBadge access={event.access} />
            {isOrganizer ? <EventStatusBadge status={event.status} /> : null}
          </div>
          <DisplayHeading as="h1" size="lg" className="reveal reveal-delay-1 text-white">
            {event.title}
          </DisplayHeading>
          {event.organizerName ? (
            <p className="reveal reveal-delay-2 mt-3 text-white/70">
              {t("organizedBy", { name: event.organizerName })}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {isOrganizer ? (
          <div className="mb-8">
            <Link href={`/organizer/events/${event.id}`} className={buttonClasses("light")}>
              {t("manage")}
            </Link>
          </div>
        ) : null}

        {event.status === "cancelled" ? (
          <div className="mb-8">
            <Alert tone="error">{t("cancelledNotice")}</Alert>
          </div>
        ) : null}

        {event.description ? (
          <p className="mb-10 max-w-3xl text-lg leading-relaxed whitespace-pre-line text-white/80">
            {event.description}
          </p>
        ) : null}

        <dl className="mb-12 grid gap-x-8 gap-y-6 border-y border-white/10 py-8 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold tracking-[0.18em] text-night-subtle uppercase">{label}</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>

        <Suspense fallback={<div className="mb-12 h-32 rounded-card bg-night-soft" aria-hidden />}>
          <RegistrationBox event={event} />
        </Suspense>

        <TextBlock title={t("program")} text={event.program} />
        <TextBlock title={t("selection")} text={event.selection_criteria} />
        <TextBlock title={t("rules")} text={event.rules} />

        {event.lat !== null && event.lng !== null ? (
          <section className="mb-12">
            <h2 className="mb-4 font-display text-3xl font-extrabold text-white uppercase">
              {t("mapTitle")}
            </h2>
            <EventMap lat={event.lat} lng={event.lng} label={t("mapTitle")} />
            {place ? <p className="mt-3 text-night-subtle">{place}</p> : null}
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
