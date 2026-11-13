import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyOrganizer, listMyEvents, listMySeasons } from "@/lib/data/events";
import { listMyOrganizers } from "@/lib/organizer/current";
import { OrganizerSwitcher } from "@/components/organizer/organizer-switcher";
import { PageShell } from "@/components/page-shell";
import { OrganizerEventList } from "@/components/organizer/event-list";
import { SeasonForm } from "@/components/organizer/season-form";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MyCohosting } from "@/components/cohosts/my-cohosting";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Organizer");
  return { title: t("title"), robots: { index: false } };
}

export default async function OrganizerPage() {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-4xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <OrganizerDashboard />
    </Suspense>
  );
}

async function OrganizerDashboard() {
  const [t, organizer] = await Promise.all([getTranslations("Organizer"), getMyOrganizer()]);
  // Jen schválený pořadatel; ostatní dostanou „nenalezeno“
  if (!organizer) notFound();

  const [seasons, unassigned, myOrganizers] = await Promise.all([
    listMySeasons(organizer.id),
    listMyEvents(organizer.id, null),
    listMyOrganizers(),
  ]);

  return (
    <PageShell
      title={t("title")}
      subtitle={organizer.name}
      actions={
        <>
          <Link href="/organizer/profile" className={buttonClasses("secondary")}>
            {t("profileLink")}
          </Link>
          <Link href="/organizer/events/new" className={buttonClasses("primary")}>
            {t("newEvent")}
          </Link>
        </>
      }
    >
      <OrganizerSwitcher
        currentId={organizer.id}
        options={myOrganizers.map((o) => ({ id: o.id, name: o.name, isCrew: Boolean(o.crewId) }))}
      />
      <div className="flex flex-col gap-8">
        <MyCohosting organizerIds={myOrganizers.map((o) => o.id)} />
        <section>
          <h2 className="mb-4 text-xl font-semibold">{t("seasonsTitle")}</h2>
          {seasons.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {seasons.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/organizer/seasons/${s.id}`}
                    className="flex flex-col rounded-card bg-muted p-5 transition-colors hover:bg-line"
                  >
                    <span className="text-lg font-semibold text-ink">{s.name}</span>
                    <span className="text-sm text-subtle">
                      {t("seasonEvents", { count: s.eventCount })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">{t("noSeasons")}</p>
          )}
        </section>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("newSeasonTitle")}</h2>
          <SeasonForm />
        </Card>

        {unassigned.length ? (
          <section>
            <h2 className="mb-4 text-xl font-semibold">{t("unassignedTitle")}</h2>
            <OrganizerEventList events={unassigned} />
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
