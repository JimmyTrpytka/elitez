import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/user";
import { countryName } from "@/lib/countries";
import { getProfileByUsername } from "@/lib/data/profiles";
import { listVisibleVehiclesOfOwner } from "@/lib/data/vehicles";
import {
  getProfileSocialStats,
  getVehicleSocial,
  listBadgeCatalog,
  listTurboGivers,
  listUserBadges,
} from "@/lib/data/social";
import { HallOfFame } from "@/components/social/hall-of-fame";
import { getProfileShare, shareMetadata } from "@/lib/data/share";
import { ShareButton } from "@/components/share-button";
import { listDreamsOfOwner } from "@/lib/data/dreams";
import { DreamCard } from "@/components/dreams/dream-card";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import { TurboToggle } from "@/components/social/turbo-button";
import { FollowButton } from "@/components/social/follow-button";
import { TurboGivers } from "@/components/social/turbo-givers";
import { TurboIcon } from "@/components/social/turbo-icon";
import { Avatar } from "@/components/avatar";
import { VehicleCard, VehicleGrid } from "@/components/garage/vehicle-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DisplayHeading, Eyebrow } from "@/components/brand";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const name = decodeURIComponent(username);
  return shareMetadata(await getProfileShare(name), `@${name}`);
}

export default async function PublicProfilePage({
  params,
}: PageProps<"/[locale]/u/[username]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-6xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <PublicProfile params={params} />
    </Suspense>
  );
}

async function PublicProfile({
  params,
}: {
  params: PageProps<"/[locale]/u/[username]">["params"];
}) {
  const { username } = await params;
  const [t, locale, profile, user] = await Promise.all([
    getTranslations("PublicProfile"),
    getLocale(),
    getProfileByUsername(decodeURIComponent(username)),
    getCurrentUser(),
  ]);
  // Soukromý profil vrátí databáze jen majiteli – ostatní uvidí „nenalezeno“
  if (!profile) notFound();

  const isOwner = user?.id === profile.id;
  const [vehicles, stats, givers, badges, catalog, dreams] = await Promise.all([
    listVisibleVehiclesOfOwner(profile.id),
    getProfileSocialStats(profile.id),
    listTurboGivers({ profileId: profile.id }),
    listUserBadges(profile.id),
    isOwner ? listBadgeCatalog() : Promise.resolve([]),
    listDreamsOfOwner(profile.id),
  ]);
  // Majitel vidí i svá soukromá vozidla; na veřejné stránce je ale nevypisujeme
  const shown = vehicles.filter((v) => v.visibility === "public");
  const current = shown.filter((v) => v.status === "current");
  const former = shown.filter((v) => v.status === "former");
  const vehicleSocial = await getVehicleSocial(shown.map((v) => v.id));
  // Fanoušek = zatím bez auta (počítají se auta, která návštěvník vidí; majitel i svá soukromá)
  const isFan = vehicles.filter((v) => v.status === "current").length === 0;
  const shownDreams = dreams.filter((d) => d.visibility === "public");
  const mode = isOwner ? "own" : user ? "active" : "guest";
  // Turba a sledování jen u veřejného profilu
  const social = profile.visibility === "public";
  const name = profile.display_name ?? profile.username ?? "";
  const place = [profile.city, profile.country ? countryName(profile.country, locale) : null]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex-1 bg-night text-night-text">
      <header className="glow-accent border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20">
          {isOwner && profile.visibility === "private" ? (
            <div className="mb-6">
              <Alert tone="info">{t("ownerPrivateNotice")}</Alert>
            </div>
          ) : null}
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
            <Avatar
              url={profile.avatarUrl}
              name={name}
              size={128}
              className="reveal ring-2 ring-accent ring-offset-4 ring-offset-night"
            />
            <div className="reveal reveal-delay-1">
              <Eyebrow dark className="mb-2">
                @{profile.username}
                {place ? ` · ${place}` : ""}
              </Eyebrow>
              <div className="flex flex-wrap items-center gap-3">
                <DisplayHeading as="h1" size="lg" className="text-white">
                  {name}
                </DisplayHeading>
                {profile.verified_at ? <Badge>Verified</Badge> : null}
                <span
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase"
                  title={isFan ? t("fanHint") : undefined}
                >
                  {isFan ? t("fan") : t("owner")}
                </span>
              </div>
              {profile.bio ? (
                <p className="mt-4 max-w-2xl text-lg whitespace-pre-line text-white/75">
                  {profile.bio}
                </p>
              ) : null}
            </div>
          </div>

          {social ? (
            <div className="reveal reveal-delay-2 mt-10 flex flex-col gap-6 border-t border-white/10 pt-8">
              <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-night-subtle uppercase">
                    {t("garageTurbos")}
                  </p>
                  <p className="mt-1 flex items-center gap-2 font-display text-5xl leading-none font-extrabold text-white">
                    <TurboIcon className="h-9 w-9 text-accent" />
                    {stats.garageTurbos}
                  </p>
                </div>
                {stats.streak > 0 ? (
                  <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-night-subtle uppercase">
                      {t("streak")}
                    </p>
                    <p className="mt-1 font-display text-5xl leading-none font-extrabold text-white">
                      <span aria-hidden>🔥 </span>
                      {t("streakDays", { count: stats.streak })}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <TurboToggle
                  target={{ profileId: profile.id }}
                  mode={mode}
                  size="lg"
                  initial={{ given: stats.iTurboed, count: stats.profileTurbos }}
                />
                <FollowButton
                  profileId={profile.id}
                  mode={mode}
                  initialFollowing={stats.iFollow}
                  initialFollowers={stats.followers}
                />
                <ShareButton title={name} />
              </div>
              {mode !== "own" ? (
                <p className="-mt-2 text-sm text-night-subtle">{t("garageTurboHint")}</p>
              ) : null}
              <TurboGivers givers={givers} total={stats.profileTurbos} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <section>
          <h2 className="mb-6 font-display text-4xl font-extrabold text-white uppercase">
            {t("garageTitle")}
          </h2>
          {current.length ? (
            <VehicleGrid>
              {current.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  href={`/v/${v.id}`}
                  tone="dark"
                  turbos={vehicleSocial.get(v.id)?.turbos}
                />
              ))}
            </VehicleGrid>
          ) : (
            <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("garageEmpty")}</p>
          )}
        </section>

        {former.length ? (
          <section className="mt-16">
            <h2 className="mb-6 font-display text-3xl font-extrabold text-white/70 uppercase">
              {t("formerTitle")}
            </h2>
            <div className="opacity-80">
              <VehicleGrid>
                {former.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    href={`/v/${v.id}`}
                    tone="dark"
                    turbos={vehicleSocial.get(v.id)?.turbos}
                  />
                ))}
              </VehicleGrid>
            </div>
          </section>
        ) : null}

        {shownDreams.length || isOwner ? (
          <section className="mt-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-4xl font-extrabold text-white uppercase">{t("dreamsTitle")}</h2>
                <p className="mt-1 text-sm text-night-subtle">{t("dreamsSubtitle")}</p>
              </div>
              {isOwner ? (
                <Link href="/garage/dreams" className={buttonClasses("outlineDark")}>
                  {t("dreamsManage")}
                </Link>
              ) : null}
            </div>
            {shownDreams.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shownDreams.map((d) => (
                  <DreamCard key={d.id} dream={d} />
                ))}
              </div>
            ) : (
              <p className="rounded-card bg-night-soft p-8 text-night-subtle">{t("dreamsEmptyOwner")}</p>
            )}
          </section>
        ) : null}

        <div className="mt-16">
          <HallOfFame earned={badges} catalog={catalog} stats={stats} isOwner={isOwner} />
        </div>
      </div>
    </div>
  );
}
