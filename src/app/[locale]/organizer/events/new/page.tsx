import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyOrganizer, listMySeasons } from "@/lib/data/events";
import { PageShell } from "@/components/page-shell";
import { EventForm } from "@/components/organizer/event-form";
import { EMPTY_EVENT_VALUES } from "@/components/organizer/event-form-values";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Organizer");
  return { title: t("newEvent"), robots: { index: false } };
}

export default async function NewEventPage({
  searchParams,
}: PageProps<"/[locale]/organizer/events/new">) {
  const [t, tAuth] = await Promise.all([
    getTranslations("Organizer"),
    getTranslations("Auth"),
  ]);
  return (
    <PageShell
      title={t("newEvent")}
      subtitle={
        <Link href="/organizer" className={textLinkClass}>
          {t("backToOrganizer")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <NewEventContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function NewEventContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/organizer/events/new">["searchParams"];
}) {
  const organizer = await getMyOrganizer();
  if (!organizer) notFound();
  const [{ season }, seasons] = await Promise.all([searchParams, listMySeasons(organizer.id)]);
  const preselected =
    typeof season === "string" && seasons.some((s) => s.id === season) ? season : "";

  return (
    <EventForm
      values={{ ...EMPTY_EVENT_VALUES, season_id: preselected }}
      seasons={seasons.map((s) => ({ id: s.id, name: s.name, year: s.year }))}
    />
  );
}
