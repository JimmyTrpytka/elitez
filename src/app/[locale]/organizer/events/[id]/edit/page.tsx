import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyEvent, getMyOrganizer, listMySeasons } from "@/lib/data/events";
import { PageShell } from "@/components/page-shell";
import { EventForm } from "@/components/organizer/event-form";
import { toEventFormValues } from "@/components/organizer/event-form-values";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Organizer");
  return { title: t("editEvent"), robots: { index: false } };
}

export default async function EditEventPage({
  params,
}: PageProps<"/[locale]/organizer/events/[id]/edit">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-2xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <EditEvent params={params} />
    </Suspense>
  );
}

async function EditEvent({
  params,
}: {
  params: PageProps<"/[locale]/organizer/events/[id]/edit">["params"];
}) {
  const { id } = await params;
  const [t, organizer] = await Promise.all([getTranslations("Organizer"), getMyOrganizer()]);
  if (!organizer) notFound();
  const [event, seasons] = await Promise.all([
    getMyEvent(organizer.id, id),
    listMySeasons(organizer.id),
  ]);
  if (!event) notFound();

  return (
    <PageShell
      title={t("editEvent")}
      subtitle={
        <Link href={`/organizer/events/${event.id}`} className={textLinkClass}>
          {t("backToEvent")}
        </Link>
      }
    >
      <EventForm
        allowCrewOnly={Boolean(organizer.crew_id)}
        values={toEventFormValues(event)}
        seasons={seasons.map((s) => ({ id: s.id, name: s.name, year: s.year }))}
      />
    </PageShell>
  );
}
