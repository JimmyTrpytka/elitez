import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listPublicEvents } from "@/lib/data/events";
import { EventCard } from "@/components/events/event-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Events");
  return { title: t("title") };
}

export default async function EventsPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Events"), getTranslations("Auth")]);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
      <p className="mb-10 max-w-2xl text-lg text-ink-soft">{t("subtitle")}</p>
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <EventsList />
      </Suspense>
    </div>
  );
}

async function EventsList() {
  const [t, { upcoming, past }] = await Promise.all([
    getTranslations("Events"),
    listPublicEvents(),
  ]);
  return (
    <>
      {upcoming.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <p className="rounded-card bg-muted p-8 text-ink-soft">{t("empty")}</p>
      )}
      {past.length ? (
        <section className="mt-16">
          <h2 className="mb-4 text-xl font-semibold">{t("pastTitle")}</h2>
          <div className="grid gap-5 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
