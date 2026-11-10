import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyOrganizer, getMySeason, listMyEvents } from "@/lib/data/events";
import { PageShell } from "@/components/page-shell";
import { BulkCreate } from "@/components/organizer/bulk-create";
import { OrganizerEventList } from "@/components/organizer/event-list";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Organizer");
  return { title: t("seasonsTitle"), robots: { index: false } };
}

export default async function SeasonPage({
  params,
}: PageProps<"/[locale]/organizer/seasons/[id]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-4xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <SeasonDetail params={params} />
    </Suspense>
  );
}

async function SeasonDetail({
  params,
}: {
  params: PageProps<"/[locale]/organizer/seasons/[id]">["params"];
}) {
  const { id } = await params;
  const [t, organizer] = await Promise.all([getTranslations("Organizer"), getMyOrganizer()]);
  if (!organizer) notFound();
  const season = await getMySeason(organizer.id, id);
  if (!season) notFound();
  const events = await listMyEvents(organizer.id, season.id);

  return (
    <PageShell
      title={season.name}
      subtitle={
        <Link href="/organizer" className={textLinkClass}>
          {t("backToOrganizer")}
        </Link>
      }
      actions={
        <Link
          href={{ pathname: "/organizer/events/new", query: { season: season.id } }}
          className={buttonClasses("primary")}
        >
          {t("newEventInSeason")}
        </Link>
      }
    >
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-4 text-xl font-semibold">{t("eventsTitle")}</h2>
          <OrganizerEventList events={events} />
        </section>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("bulkTitle")}</h2>
          <BulkCreate seasonId={season.id} />
        </Card>
      </div>
    </PageShell>
  );
}
