import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { getCrewBySlug, listCrewBadges, listCrewMembers } from "@/lib/data/crews";
import { DisplayHeading, Eyebrow } from "@/components/brand";
import { Avatar } from "@/components/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { OrganizerLogo } from "@/components/organizers/organizer-logo";
import { ShareButton } from "@/components/share-button";
import { TurboIcon } from "@/components/social/turbo-icon";
import { BadgeMedal, RARITY_COLOR } from "@/components/social/badge-medal";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { CrewMembership } from "@/components/crews/crew-membership";
import { CrewMemberAdmin } from "@/components/crews/crew-member-admin";
import { CrewOrganizerRequest } from "@/components/crews/crew-organizer-request";
import { EventCard } from "@/components/events/event-card";
import { listPublicEvents } from "@/lib/data/events";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[slug]">): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getTranslations("Crews")]);
  const crew = await getCrewBySlug(decodeURIComponent(slug));
  return { title: crew?.status === "approved" ? `${crew.name} · Crew` : t("title") };
}

export default async function CrewPage(props: PageProps<"/[locale]/c/[slug]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}>
      <CrewDetail {...props} />
    </Suspense>
  );
}

async function CrewDetail({ params, searchParams }: PageProps<"/[locale]/c/[slug]">) {
  const [{ slug }, { created }, t, locale, user] = await Promise.all([
    params,
    searchParams,
    getTranslations("Crews"),
    getLocale(),
    getCurrentUser(),
  ]);
  const crew = await getCrewBySlug(decodeURIComponent(slug));
  if (!crew) notFound();
  const isManager = crew.stats.myRole === "founder" || crew.stats.myRole === "admin";
  const supabase = await createClient();
  const { data: organizer } = supabase
    ? await supabase.from("organizers").select("id, status").eq("crew_id", crew.id).eq("status", "approved").maybeSingle()
    : { data: null };
  const [members, badges, meets] = await Promise.all([
    listCrewMembers(crew.id, isManager),
    listCrewBadges(crew.id),
    organizer ? listPublicEvents(organizer.id, true) : Promise.resolve({ upcoming: [], past: [] }),
  ]);
  const active = members.filter((m) => m.status === "active");
  const requests = members.filter((m) => m.status === "pending");
  const en = locale === "en";

  return (
    <div className="flex-1 bg-night text-night-text">
      {/* Úvodní fotka + hlavička */}
      <header className="relative isolate overflow-hidden border-b border-white/10">
        {crew.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={crew.coverUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : (
          <div className="glow-accent absolute inset-0 -z-10" aria-hidden />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/70 to-night/20" aria-hidden />
        <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-10 sm:px-6 sm:pt-40">
          {created ? (
            <div className="mb-6">
              <Alert tone="success">{t("createdNotice")}</Alert>
            </div>
          ) : null}
          {crew.status !== "approved" ? (
            <div className="mb-6">
              <Alert tone="info">
                {t(`statusNotice.${crew.status}`)}
                {crew.status === "rejected" && crew.rejection_reason ? ` ${t("rejectedReason", { reason: crew.rejection_reason })}` : ""}
              </Alert>
            </div>
          ) : null}
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
            <OrganizerLogo url={crew.logoUrl} name={crew.name} size={112} className="ring-2 ring-accent ring-offset-4 ring-offset-night" />
            <div className="min-w-0">
              <Eyebrow dark className="mb-2">
                Crew{crew.focus ? ` · ${crew.focus}` : ""}
              </Eyebrow>
              <DisplayHeading as="h1" size="lg" className="text-white">
                {crew.name}
              </DisplayHeading>
            </div>
          </div>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.18em] text-night-subtle uppercase">{t("statMembers")}</dt>
              <dd className="font-display text-4xl leading-none font-extrabold text-white">{crew.stats.members}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.18em] text-night-subtle uppercase">{t("statTurbos")}</dt>
              <dd className="flex items-center gap-2 font-display text-4xl leading-none font-extrabold text-white">
                <TurboIcon className="h-7 w-7 text-accent" />
                {crew.stats.turbosTotal}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.18em] text-night-subtle uppercase">{t("statMonth")}</dt>
              <dd className="font-display text-4xl leading-none font-extrabold text-white">{crew.stats.turbosMonth}</dd>
            </div>
          </dl>
          {crew.status === "approved" ? (
            <div className="mt-8 flex flex-wrap items-start gap-3">
              <CrewMembership
                crewId={crew.id}
                status={crew.stats.myStatus}
                role={crew.stats.myRole}
                isHome={crew.stats.myHome}
                joinPolicy={crew.join_policy}
                signedIn={Boolean(user)}
              />
              <ShareButton title={crew.name} />
              {isManager ? (
                <Link href={`/c/${crew.slug}/edit`} className={buttonClasses("light", "lg")}>
                  {t("edit")}
                </Link>
              ) : null}
            </div>
          ) : isManager ? (
            <div className="mt-8">
              <Link href={`/c/${crew.slug}/edit`} className={buttonClasses("light")}>
                {t("edit")}
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-12 sm:px-6 sm:py-16">
        {crew.description ? (
          <p className="max-w-3xl text-lg leading-relaxed whitespace-pre-line text-white/80">{crew.description}</p>
        ) : null}

        {isManager && crew.status === "approved" ? (
          <section className="flex flex-col gap-3 rounded-card bg-night-soft p-6 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white uppercase">{t("meetsAdminTitle")}</h2>
              <p className="text-sm text-night-subtle">{organizer ? t("meetsAdminOn") : t("meetsAdminOff")}</p>
            </div>
            <CrewOrganizerRequest
              crewId={crew.id}
              organizerId={organizer?.id ?? null}
              requested={Boolean(crew.organizer_requested_at)}
            />
          </section>
        ) : null}

        {organizer && (meets.upcoming.length || meets.past.length) ? (
          <section>
            <h2 className="mb-6 font-display text-4xl font-extrabold text-white uppercase">{t("meetsTitle")}</h2>
            {meets.upcoming.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {meets.upcoming.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            ) : (
              <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("meetsNone")}</p>
            )}
            {meets.past.length ? (
              <div className="mt-10">
                <h3 className="mb-4 font-display text-2xl font-extrabold text-white/80 uppercase">{t("meetsPast")}</h3>
                <div className="grid gap-5 opacity-70 grayscale-[40%] sm:grid-cols-2 lg:grid-cols-3">
                  {meets.past.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {isManager && requests.length ? (
          <section id="zadosti" className="scroll-mt-24 rounded-card bg-night-soft p-6 ring-1 ring-accent/40">
            <ScrollToHash id="zadosti" />
            <h2 className="mb-4 font-display text-3xl font-extrabold text-white uppercase">
              {t("requestsTitle", { count: requests.length })}
            </h2>
            <ul className="flex flex-col gap-3">
              {requests.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/u/${m.username}`} className="flex items-center gap-3">
                    <Avatar url={m.avatarUrl} name={m.displayName ?? m.username} size={44} />
                    <span>
                      <span className="block font-semibold text-white">{m.displayName ?? m.username}</span>
                      <span className="text-sm text-night-subtle">@{m.username}</span>
                    </span>
                  </Link>
                  <CrewMemberAdmin crewId={crew.id} userId={m.userId} status="pending" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {badges.length ? (
          <section>
            <h2 className="mb-6 font-display text-4xl font-extrabold text-white uppercase">{t("badgesTitle")}</h2>
            <ul className="flex flex-wrap gap-4">
              {badges.map((b) => (
                <li key={b.id} className="flex w-40 flex-col items-center rounded-card bg-night-soft p-4 text-center ring-1 ring-white/10">
                  <BadgeMedal icon={b.badge.icon} rarity={b.badge.rarity} size={64} />
                  <p className="mt-3 font-display text-lg leading-tight font-extrabold text-white uppercase">
                    {en ? b.badge.name_en : b.badge.name_cs}
                    {b.contextKey ? ` ${b.contextKey}` : ""}
                  </p>
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: RARITY_COLOR[b.badge.rarity] }}>
                    {t(`rarity.${b.badge.rarity}`)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-6 font-display text-4xl font-extrabold text-white uppercase">{t("membersTitle")}</h2>
          {active.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 rounded-card bg-night-soft p-4 ring-1 ring-white/10">
                  <Link href={`/u/${m.username}`} className="flex min-w-0 items-center gap-3">
                    <Avatar url={m.avatarUrl} name={m.displayName ?? m.username} size={48} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-white">{m.displayName ?? m.username}</span>
                        {m.verified ? <Badge>Verified</Badge> : null}
                      </span>
                      <span className="text-sm text-night-subtle">
                        @{m.username}
                        {m.role !== "member" ? ` · ${t(`role.${m.role}`)}` : ""}
                      </span>
                    </span>
                  </Link>
                  {isManager && m.role === "member" ? (
                    <CrewMemberAdmin crewId={crew.id} userId={m.userId} status="active" />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("noMembers")}</p>
          )}
          {crew.stats.members > active.length ? (
            <p className="mt-3 text-sm text-night-subtle">{t("hiddenMembers", { count: crew.stats.members - active.length })}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
