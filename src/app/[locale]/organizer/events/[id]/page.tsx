import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatEventDates } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import { PageShell } from "@/components/page-shell";
import { SavedNotice } from "@/components/ui/saved-notice";
import { EventAccessBadge, EventStatusBadge } from "@/components/events/status-badge";
import { EventCoverUploader } from "@/components/organizer/event-cover-uploader";
import { EventStatusPanel } from "@/components/organizer/event-status-panel";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { textLinkClass } from "@/components/auth/auth-shell";
import { listEventMediaRequests, mediaStatus } from "@/lib/data/media";
import { OrganizerMediaList } from "@/components/media/organizer-media-list";
import { listEventCohosts } from "@/lib/data/cohosts";
import { listPublicOrganizers } from "@/lib/data/organizers";
import { HostCohostPanel } from "@/components/cohosts/host-cohost-panel";

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
  const [tMedia, tCohosts, mediaRows, cohosts, allOrganizers] = await Promise.all([
    getTranslations("Media"),
    getTranslations("Cohosts"),
    listEventMediaRequests(event.id),
    listEventCohosts(event.id),
    listPublicOrganizers(),
  ]);
  const mediaApproved = mediaRows.filter((r) => r.status === "approved").length;

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
      <SavedNotice />
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
          <h2 className="mb-1 text-lg font-semibold">{tCohosts("hostTitle")}</h2>
          <HostCohostPanel
            eventId={event.id}
            eligible={event.status === "published" && (event.access === "public" || event.access === "verified_only")}
            cohosts={cohosts}
            options={allOrganizers.filter((o) => o.id !== event.organizer_id).map((o) => ({ slug: o.slug, name: o.name }))}
          />
        </Card>
        <Card>
          <h2 className="mb-1 text-lg font-semibold">{tMedia("organizerTitle")}</h2>
          <p className="mb-4 text-sm text-ink-soft">
            {event.media_enabled
              ? event.media_capacity
                ? tMedia("organizerLimited", { approved: mediaApproved, capacity: event.media_capacity })
                : tMedia("organizerUnlimited", { approved: mediaApproved })
              : tMedia("organizerDisabled")}
          </p>
          {mediaRows.length ? (
            <OrganizerMediaList
              items={mediaRows.map((r) => ({
                id: r.id,
                status: mediaStatus(r.status),
                name: r.profile?.display_name || r.profile?.username || "—",
                username: r.profile?.username ?? null,
                avatarUrl: r.profile?.avatarUrl ?? null,
                skills: r.skills,
                phone: r.contact_phone,
                email: r.contact_email,
                message: r.message,
                decisionMessage: r.decision_message,
              }))}
            />
          ) : event.media_enabled ? (
            <p className="text-sm text-subtle">{tMedia("organizerEmpty")}</p>
          ) : (
            <Link href={`/organizer/events/${event.id}/edit`} className={textLinkClass}>
              {tMedia("organizerEnable")}
            </Link>
          )}
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
