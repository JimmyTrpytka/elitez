import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { getOrganizerBySlug } from "@/lib/data/organizers";
import { getOrganizerShare, shareMetadata } from "@/lib/data/share";
import { listPublicEvents } from "@/lib/data/events";
import { DisplayHeading, Eyebrow } from "@/components/brand";
import { EventCard } from "@/components/events/event-card";
import { FollowButton } from "@/components/social/follow-button";
import { ShareButton } from "@/components/share-button";
import { OrganizerLogo } from "@/components/organizers/organizer-logo";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/[locale]/o/[slug]">): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getTranslations("Organizers")]);
  return shareMetadata(await getOrganizerShare(decodeURIComponent(slug)), t("titleSingle"));
}

export default async function OrganizerPage({ params }: PageProps<"/[locale]/o/[slug]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}>
      <OrganizerProfile params={params} />
    </Suspense>
  );
}

async function OrganizerProfile({ params }: { params: PageProps<"/[locale]/o/[slug]">["params"] }) {
  const { slug } = await params;
  const [t, organizer, user] = await Promise.all([
    getTranslations("Organizers"),
    getOrganizerBySlug(decodeURIComponent(slug)),
    getCurrentUser(),
  ]);
  if (!organizer) notFound();

  const { upcoming, past } = await listPublicEvents(organizer.id);
  const isOwner = user?.id === organizer.profile_id;
  const mode = isOwner ? "own" : user ? "active" : "guest";
  const links = [
    { href: organizer.website_url, label: t("website") },
    { href: organizer.instagram_url, label: "Instagram" },
    { href: organizer.facebook_url, label: "Facebook" },
  ].filter((l): l is { href: string; label: string } => Boolean(l.href));

  return (
    <div className="flex-1 bg-night text-night-text">
      <header className="glow-accent border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
            <OrganizerLogo
              url={organizer.logoUrl}
              name={organizer.name}
              size={128}
              className="reveal ring-2 ring-accent ring-offset-4 ring-offset-night"
            />
            <div className="reveal reveal-delay-1 min-w-0">
              <Eyebrow dark className="mb-2">
                {t("titleSingle")}
              </Eyebrow>
              <DisplayHeading as="h1" size="lg" className="text-white">
                {organizer.name}
              </DisplayHeading>
              {organizer.description ? (
                <p className="mt-4 max-w-2xl text-lg whitespace-pre-line text-white/75">{organizer.description}</p>
              ) : null}
              {links.length ? (
                <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-semibold text-white underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
          <div className="reveal reveal-delay-2 mt-8 flex flex-wrap items-center gap-4 border-t border-white/10 pt-8">
            <FollowButton
              kind="organizer"
              profileId={organizer.id}
              mode={mode}
              initialFollowing={organizer.iFollow}
              initialFollowers={organizer.followers}
            />
            <ShareButton title={organizer.name} />
            {isOwner ? (
              <Link href="/organizer/profile" className={buttonClasses("light")}>
                {t("editProfile")}
              </Link>
            ) : null}
          </div>
          {mode !== "own" ? <p className="mt-3 text-sm text-night-subtle">{t("followHint")}</p> : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <section>
          <h2 className="mb-6 font-display text-4xl font-extrabold text-white uppercase">{t("upcomingTitle")}</h2>
          {upcoming.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("noUpcoming")}</p>
          )}
        </section>

        {organizer.show_past_events && past.length ? (
          <section className="mt-16">
            <h2 className="mb-6 font-display text-3xl font-extrabold text-white/80 uppercase">{t("pastTitle")}</h2>
            <div className="grid gap-5 opacity-70 grayscale-[40%] sm:grid-cols-2 lg:grid-cols-3">
              {past.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
