import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { listPublicEvents } from "@/lib/data/events";
import { listLatestPublicVehicles } from "@/lib/data/vehicles";
import { DarkSection, DisplayHeading, Eyebrow, Highlight } from "@/components/brand";
import { EventCard } from "@/components/events/event-card";
import { VehicleCard } from "@/components/garage/vehicle-card";
import { buttonClasses } from "@/components/ui/button";

/** Úvodní fotka (public/brand/hero.jpg). Když chybí, zůstane tmavé pozadí se září. */
const HERO_IMAGE = "/brand/hero.jpg";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <>
      {/* 1) Úvod přes celou obrazovku */}
      <DarkSection className="-mt-px overflow-hidden" glow>
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night via-night/70 to-night/30" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-night/80 via-transparent to-transparent" />

        <div className="relative mx-auto flex min-h-[78svh] w-full max-w-6xl flex-col justify-end px-4 pt-28 pb-14 sm:min-h-[86svh] sm:px-6 sm:pb-20">
          <Eyebrow dark className="reveal mb-5">
            {t("eyebrow")}
          </Eyebrow>
          <DisplayHeading as="h1" size="xl" className="reveal reveal-delay-1 max-w-5xl text-white">
            {t("titleA")} <br className="hidden sm:block" />
            {t("titleB")} <Highlight dark>{t("titleC")}</Highlight>
          </DisplayHeading>
          <p className="reveal reveal-delay-2 mt-6 max-w-xl text-lg text-white/80">{t("subtitle")}</p>
          <div className="reveal reveal-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
            <Suspense
              fallback={
                <Link href="/register" className={buttonClasses("primary", "lg")}>
                  {t("ctaRegister")}
                </Link>
              }
            >
              <PrimaryCta />
            </Suspense>
            <Link href="/events" className={buttonClasses("outlineDark", "lg")}>
              {t("ctaEvents")}
            </Link>
          </div>
        </div>
      </DarkSection>

      {/* 2) Nejbližší eventy */}
      <DarkSection glow={false} className="border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow dark className="mb-3">
                {t("eventsEyebrow")}
              </Eyebrow>
              <DisplayHeading className="text-white">
                {t("eventsTitleA")} <Highlight dark>{t("eventsTitleB")}</Highlight>
              </DisplayHeading>
            </div>
            <Link href="/events" className={buttonClasses("outlineDark")}>
              {t("allEvents")}
            </Link>
          </div>
          <Suspense fallback={<div className="h-96 rounded-card bg-night-soft" aria-hidden />}>
            <UpcomingEvents />
          </Suspense>
        </div>
      </DarkSection>

      {/* 3) Z garáží členů */}
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow className="mb-3">{t("garagesEyebrow")}</Eyebrow>
              <DisplayHeading className="text-ink">
                {t("garagesTitleA")} <Highlight>{t("garagesTitleB")}</Highlight>
              </DisplayHeading>
            </div>
            <Link href="/members" className={buttonClasses("secondary")}>
              {t("allMembers")}
            </Link>
          </div>
          <Suspense fallback={<div className="h-72 rounded-card bg-muted" aria-hidden />}>
            <LatestVehicles />
          </Suspense>
        </div>
      </section>

      {/* 4) Jak to funguje */}
      <section className="bg-muted">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Eyebrow className="mb-3">{t("howEyebrow")}</Eyebrow>
            <DisplayHeading className="text-ink">
              {t("howTitleA")} <Highlight>{t("howTitleB")}</Highlight>
            </DisplayHeading>
            <p className="mt-5 max-w-md text-lg text-ink-soft">{t("howText")}</p>
          </div>
          <ol className="divide-y divide-line border-y border-line">
            {(["garage", "events", "badges"] as const).map((key, i) => (
              <li key={key} className="flex gap-6 py-6">
                <span className="font-display text-2xl font-bold text-subtle">0{i + 1}</span>
                <div>
                  <p className="font-display text-3xl font-extrabold text-ink uppercase">
                    {t(`steps.${key}.title`)}
                  </p>
                  <p className="mt-1 text-ink-soft">{t(`steps.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5) Výzva */}
      <DarkSection>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28">
          <DisplayHeading size="lg" className="max-w-3xl text-white">
            {t("ctaTitleA")} <Highlight dark>{t("ctaTitleB")}</Highlight>
          </DisplayHeading>
          <p className="max-w-xl text-lg text-white/75">{t("ctaText")}</p>
          <Suspense
            fallback={
              <Link href="/register" className={buttonClasses("primary", "lg")}>
                {t("ctaRegister")}
              </Link>
            }
          >
            <PrimaryCta />
          </Suspense>
        </div>
      </DarkSection>
    </>
  );
}

/** Nepřihlášeným „Založit účet“, přihlášeným „Moje garáž“. */
async function PrimaryCta() {
  const [t, user] = await Promise.all([getTranslations("Home"), getCurrentUser()]);
  return user ? (
    <Link href="/garage" className={buttonClasses("primary", "lg")}>
      {t("ctaGarage")}
    </Link>
  ) : (
    <Link href="/register" className={buttonClasses("primary", "lg")}>
      {t("ctaRegister")}
    </Link>
  );
}

async function UpcomingEvents() {
  const [t, { upcoming }] = await Promise.all([getTranslations("Home"), listPublicEvents()]);
  if (upcoming.length === 0) {
    return <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("noEvents")}</p>;
  }
  const [first, ...rest] = upcoming.slice(0, 3);
  return (
    <div className={rest.length ? "grid gap-5 lg:grid-cols-[1.4fr_1fr]" : ""}>
      <EventCard event={first} size="lg" className={rest.length ? "lg:aspect-auto lg:h-full" : undefined} />
      {rest.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {rest.map((e) => (
            <EventCard key={e.id} event={e} className="lg:aspect-[16/10]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function LatestVehicles() {
  const [t, vehicles] = await Promise.all([getTranslations("Home"), listLatestPublicVehicles(6)]);
  if (vehicles.length === 0) {
    return <p className="rounded-card bg-muted p-8 text-ink-soft">{t("noVehicles")}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((v) => (
        <VehicleCard key={v.id} vehicle={v} href={`/v/${v.id}`} />
      ))}
    </div>
  );
}
