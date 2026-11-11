import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listPublicEvents } from "@/lib/data/events";
import { DarkSection, DisplayHeading, Eyebrow } from "@/components/brand";
import { EventCard } from "@/components/events/event-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Events");
  return { title: t("title") };
}

export default async function EventsPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Events"), getTranslations("Auth")]);
  return (
    <DarkSection className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <Eyebrow dark className="reveal mb-4">
          {t("eyebrow")}
        </Eyebrow>
        <DisplayHeading as="h1" size="lg" className="reveal reveal-delay-1 text-white">
          {t("title")}
        </DisplayHeading>
        <p className="reveal reveal-delay-2 mt-4 mb-12 max-w-2xl text-lg text-white/75">
          {t("subtitle")}
        </p>
        <Suspense fallback={<p className="text-night-subtle">{tAuth("loading")}</p>}>
          <EventsList />
        </Suspense>
      </div>
    </DarkSection>
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
        <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("empty")}</p>
      )}
      {past.length ? (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-3xl font-extrabold text-white/80 uppercase">
            {t("pastTitle")}
          </h2>
          <div className="grid gap-5 opacity-70 grayscale-[40%] sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
