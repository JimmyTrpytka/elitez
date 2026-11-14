import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { listPublicEvents } from "@/lib/data/events";
import { listLatestPublicVehicles } from "@/lib/data/vehicles";
import { DarkSection, DisplayHeading, Eyebrow, Highlight } from "@/components/brand";
import { EventCard } from "@/components/events/event-card";
import { BadgeMedal } from "@/components/social/badge-medal";
import { TurboIcon } from "@/components/social/turbo-icon";
import { CarIcon, CalendarIcon, ShieldIcon, CameraIcon } from "@/components/icons";
import { CarMarquee } from "@/components/welcome/car-marquee";
import { TurboDemo } from "@/components/welcome/turbo-demo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Pozvánka do testování (odkaz pro přátele): lákavé představení klubu,
 * cíl = registrace a první kroky v aplikaci.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Welcome");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      type: "website",
      siteName: "ELITEZ",
      images: [{ url: HERO_IMAGE, alt: t("metaTitle") }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [HERO_IMAGE],
    },
  };
}

const HERO_IMAGE = "/brand/hero.jpg";
const FEATURES = [
  { key: "garage", Icon: CarIcon },
  { key: "events", Icon: CalendarIcon },
  { key: "crew", Icon: ShieldIcon },
  { key: "creator", Icon: CameraIcon },
] as const;
const MISSIONS = ["profile", "car", "turbo", "event", "crew", "feedback"] as const;

export default async function WelcomePage() {
  const t = await getTranslations("Welcome");

  return (
    <>
      {/* 1) Úvod */}
      <DarkSection className="-mt-px overflow-hidden" glow>
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night via-night/75 to-night/30" />
        <div className="relative mx-auto flex min-h-[88svh] w-full max-w-6xl flex-col justify-end px-4 pt-24 pb-14 sm:px-6 sm:pb-20">
          <span className="reveal mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-ink uppercase">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ink" aria-hidden />
            {t("heroBadge")}
          </span>
          <DisplayHeading as="h1" size="lg" className="reveal reveal-delay-1 max-w-4xl text-white">
            {t("heroTitleA")} <br className="hidden sm:block" />
            {t("heroTitleB")} <Highlight dark>{t("heroTitleC")}</Highlight>
          </DisplayHeading>
          <p className="reveal reveal-delay-2 mt-6 max-w-xl text-lg text-white/85 sm:text-xl">{t("heroText")}</p>
          <div className="reveal reveal-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
            <Suspense fallback={<JoinButton />}>
              <PrimaryCta />
            </Suspense>
            <a href="#co-te-ceka" className={buttonClasses("outlineDark", "lg")}>
              {t("heroExplore")}
            </a>
          </div>
          <ul className="reveal reveal-delay-3 mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
            {(["free", "fast", "noAds"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="text-accent" aria-hidden>
                  ✓
                </span>
                {t(`trust.${k}`)}
              </li>
            ))}
          </ul>
        </div>
      </DarkSection>

      {/* 2) Auta členů – běžící pás */}
      <DarkSection glow={false} className="border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 pt-14 pb-6 sm:px-6">
          <Eyebrow dark className="mb-2">
            {t("carsEyebrow")}
          </Eyebrow>
          <p className="font-display text-3xl font-extrabold text-white uppercase sm:text-4xl">{t("carsTitle")}</p>
        </div>
        <Suspense fallback={<div className="h-56" aria-hidden />}>
          <Cars />
        </Suspense>
        <div className="h-14" aria-hidden />
      </DarkSection>

      {/* 3) Co tě čeká */}
      <DarkSection glow={false} id="co-te-ceka" className="scroll-mt-16 border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Eyebrow dark className="mb-3">
            {t("featuresEyebrow")}
          </Eyebrow>
          <DisplayHeading className="mb-10 max-w-3xl text-white">
            {t("featuresTitleA")} <Highlight dark>{t("featuresTitleB")}</Highlight>
          </DisplayHeading>
          <ul className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ key, Icon }, i) => (
              <li
                key={key}
                className="group relative overflow-hidden rounded-card bg-night-soft p-6 ring-1 ring-white/10 transition-all duration-500 hover:-translate-y-1 hover:ring-accent/50 sm:p-8"
              >
                <span
                  aria-hidden
                  className="absolute -top-6 -right-2 font-display text-[9rem] leading-none font-extrabold text-white/[0.04] transition-colors group-hover:text-accent/10"
                >
                  0{i + 1}
                </span>
                <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink">
                  <Icon className="h-7 w-7" />
                </span>
                <p className="font-display text-3xl font-extrabold text-white uppercase">{t(`features.${key}.title`)}</p>
                <p className="mt-2 max-w-md text-white/70">{t(`features.${key}.text`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </DarkSection>

      {/* 4) Nejbližší srazy */}
      <Suspense fallback={null}>
        <Events />
      </Suspense>

      {/* 5) Turbo */}
      <DarkSection className="border-t border-white/10">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
          <div>
            <Eyebrow dark className="mb-3">
              {t("turboEyebrow")}
            </Eyebrow>
            <DisplayHeading className="text-white">
              {t("turboTitleA")} <Highlight dark>{t("turboTitleB")}</Highlight>
            </DisplayHeading>
            <p className="mt-5 max-w-md text-lg text-white/75">{t("turboText")}</p>
          </div>
          <div className="flex justify-center rounded-card bg-night-soft py-12 ring-1 ring-white/10">
            <TurboDemo />
          </div>
        </div>
      </DarkSection>

      {/* 6) Testovací mise */}
      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <Eyebrow className="mb-3">{t("missionEyebrow")}</Eyebrow>
            <DisplayHeading className="text-ink">
              {t("missionTitleA")} <Highlight>{t("missionTitleB")}</Highlight>
            </DisplayHeading>
            <p className="mt-5 max-w-md text-lg text-ink-soft">{t("missionText")}</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {MISSIONS.map((key, i) => (
              <li key={key} className="flex gap-4 rounded-card bg-muted p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-ink">{t(`missions.${key}.title`)}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{t(`missions.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7) Odznak Beta tester */}
      <DarkSection>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
          <BadgeMedal icon="beta" rarity="legendary" size={140} className="reveal" />
          <Eyebrow dark>{t("badgeEyebrow")}</Eyebrow>
          <DisplayHeading className="max-w-3xl text-white">
            {t("badgeTitleA")} <Highlight dark>{t("badgeTitleB")}</Highlight>
          </DisplayHeading>
          <p className="max-w-xl text-lg text-white/75">{t("badgeText")}</p>
        </div>
      </DarkSection>

      {/* 8) Testuješ s námi */}
      <section className="bg-muted">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="max-w-2xl">
            <p className="font-display text-3xl font-extrabold text-ink uppercase">{t("feedbackTitle")}</p>
            <p className="mt-2 text-ink-soft">{t("feedbackText")}</p>
          </div>
          <Link href="/feedback" className={cn(buttonClasses("secondary", "lg"), "shrink-0")}>
            {t("feedbackCta")}
          </Link>
        </div>
      </section>

      {/* 9) Výzva */}
      <DarkSection glow>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28">
          <DisplayHeading size="xl" className="max-w-4xl text-white">
            {t("finalTitleA")} <Highlight dark>{t("finalTitleB")}</Highlight>
          </DisplayHeading>
          <p className="max-w-xl text-lg text-white/75">{t("finalText")}</p>
          <Suspense fallback={<JoinButton />}>
            <PrimaryCta />
          </Suspense>
        </div>
      </DarkSection>
    </>
  );
}

async function JoinButton() {
  const t = await getTranslations("Welcome");
  return (
    <Link href="/register" className={cn(buttonClasses("primary", "lg"), "gap-2")}>
      <TurboIcon className="h-6 w-6" filled />
      {t("ctaJoin")}
    </Link>
  );
}

/** Nepřihlášený → registrace, přihlášený → rovnou do účtu (mise). */
async function PrimaryCta() {
  const [t, user] = await Promise.all([getTranslations("Welcome"), getCurrentUser()]);
  if (!user) return <JoinButton />;
  return (
    <Link href="/account" className={cn(buttonClasses("primary", "lg"), "gap-2")}>
      <TurboIcon className="h-6 w-6" filled />
      {t("ctaContinue")}
    </Link>
  );
}

async function Cars() {
  const vehicles = await listLatestPublicVehicles(12);
  return <CarMarquee vehicles={vehicles} />;
}

async function Events() {
  const [t, { upcoming }] = await Promise.all([getTranslations("Welcome"), listPublicEvents()]);
  if (!upcoming.length) return null;
  const shown = upcoming.slice(0, 3);
  return (
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
            {t("eventsAll")}
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </div>
    </DarkSection>
  );
}
