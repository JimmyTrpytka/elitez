import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPublicOrganizers } from "@/lib/data/organizers";
import { DarkSection, DisplayHeading, Eyebrow } from "@/components/brand";
import { OrganizerLogo } from "@/components/organizers/organizer-logo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Organizers");
  return { title: t("title") };
}

export default async function OrganizersPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Organizers"), getTranslations("Auth")]);
  return (
    <DarkSection className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <Eyebrow dark className="reveal mb-4">
          {t("eyebrow")}
        </Eyebrow>
        <DisplayHeading as="h1" size="lg" className="reveal reveal-delay-1 text-white">
          {t("title")}
        </DisplayHeading>
        <p className="reveal reveal-delay-2 mt-4 mb-12 max-w-2xl text-lg text-white/75">{t("subtitle")}</p>
        <Suspense fallback={<p className="text-night-subtle">{tAuth("loading")}</p>}>
          <OrganizersList />
        </Suspense>
      </div>
    </DarkSection>
  );
}

async function OrganizersList() {
  const [t, organizers] = await Promise.all([getTranslations("Organizers"), listPublicOrganizers()]);
  if (organizers.length === 0) {
    return <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("empty")}</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {organizers.map((o) => (
        <li key={o.id}>
          <Link
            href={`/o/${o.slug}`}
            className="group flex h-full flex-col gap-4 rounded-card bg-night-soft p-6 ring-1 ring-white/10 transition-all hover:-translate-y-1 hover:ring-accent/40"
          >
            <div className="flex items-center gap-4">
              <OrganizerLogo url={o.logoUrl} name={o.name} size={64} />
              <p className="font-display text-3xl leading-tight font-extrabold text-white uppercase">{o.name}</p>
            </div>
            {o.description ? <p className="line-clamp-3 text-sm text-white/70">{o.description}</p> : null}
            <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold text-accent">{t("upcoming", { count: o.upcomingEvents })}</span>
              <span className="text-night-subtle">{t("followers", { count: o.followers })}</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
