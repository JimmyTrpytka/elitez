import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatEventDates } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import { PageShell } from "@/components/page-shell";
import { EventAccessBadge, EventStatusBadge } from "@/components/events/status-badge";
import { EventCoverUploader } from "@/components/organizer/event-cover-uploader";
import { EventStatusPanel } from "@/components/organizer/event-status-panel";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Organizer");
  return { title: t("manageEvent"), robots: { index: false } };
}

export default async function ManageEventPage({
  params,
}: PageProps<"/[locale]/organizer/events/[id]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-4xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <ManageEvent params={params} />
    </Suspense>
  );
}

async function ManageEvent({
  params,
}: {
  params: PageProps<"/[locale]/organizer/events/[id]">["params"];
}) {
  const { id } = await params;
  const [t, locale, organizer] = await Promise.all([
    getTranslations("Organizer"),
    getLocale(),
    getMyOrganizer(),
  ]);
  if (!organizer) notFound();
  const event = await getMyEvent(organizer.id, id);
  if (!event) notFound();

  const facts: Array<[string, string]> = [
    [t("factDates"), formatEventDates(event.starts_at, event.ends_at, locale, event.timezone)],
    [t("factPlace"), [event.venue_name, event.venue_address].filter(Boolean).join(", ") || "—"],
    [t("factCapacity"), event.capacity ? String(event.capacity) : t("unlimited")],
    [
      t("factRegistration"),
      event.registration_opens_at
        ? `${formatDateTime(event.registration_opens_at, locale, event.timezone)}${
            event.registration_closes_at
              ? ` – ${formatDateTime(event.registration_closes_at, locale, event.timezone)}`
              : ""
          }`
        : t("notSet"),
    ],
    [
      t("factVerified"),
      event.registration_verified_opens_at
        ? formatDateTime(event.registration_verified_opens_at, locale, event.timezone)
        : t("notSet"),
    ],
  ];

  return (
    <PageShell
      title={event.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-3">
          <Link
            href={event.season_id ? `/organizer/seasons/${event.season_id}` : "/organizer"}
            className={textLinkClass}
          >
            {event.seasonName ? `← ${event.seasonName}` : t("backToOrganizer")}
          </Link>
          <EventStatusBadge status={event.status} />
          <EventAccessBadge access={event.access} />
        </span>
      }
      actions={
        <>
          <Link
            href={`/organizer/events/${event.id}/registrations`}
            className={buttonClasses("primary")}
          >
            {t("registrations")}
          </Link>
          <Link href={`/organizer/events/${event.id}/edit`} className={buttonClasses("secondary")}>
            {t("editEvent")}
          </Link>
          <Link href={`/e/${event.slug}`} className={buttonClasses("ghost")}>
            {t("viewPublic")}
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("statusTitle")}</h2>
          <EventStatusPanel eventId={event.id} status={event.status} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("coverTitle")}</h2>
          <EventCoverUploader eventId={event.id} coverUrl={event.cover.md ?? null} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("participantsTitle")}</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organizer/events/${event.id}/messages`}
              className={buttonClasses("secondary")}
            >
              {t("writeToParticipants")}
            </Link>
            <a
              href={`/api/organizer/events/${event.id}/export?status=approved&lang=${locale}`}
              className={buttonClasses("ghost")}
            >
              {t("exportApproved")}
            </a>
            <a
              href={`/api/organizer/events/${event.id}/export?status=all&lang=${locale}`}
              className={buttonClasses("ghost")}
            >
              {t("exportAll")}
            </a>
            <Link href={`/organizer/events/${event.id}/print`} className={buttonClasses("ghost")}>
              {t("printList")}
            </Link>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("summaryTitle")}</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-subtle">{label}</dt>
                <dd className="font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </PageShell>
  );
}
