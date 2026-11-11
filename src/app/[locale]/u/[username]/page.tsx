import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/user";
import { countryName } from "@/lib/countries";
import { getProfileByUsername } from "@/lib/data/profiles";
import { listVisibleVehiclesOfOwner } from "@/lib/data/vehicles";
import { Avatar } from "@/components/avatar";
import { VehicleCard, VehicleGrid } from "@/components/garage/vehicle-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DisplayHeading, Eyebrow } from "@/components/brand";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
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
  const vehicles = await listVisibleVehiclesOfOwner(profile.id);
  // Majitel vidí i svá soukromá vozidla; na veřejné stránce je ale nevypisujeme
  const shown = vehicles.filter((v) => v.visibility === "public");
  const current = shown.filter((v) => v.status === "current");
  const former = shown.filter((v) => v.status === "former");
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
              </div>
              {profile.bio ? (
                <p className="mt-4 max-w-2xl text-lg whitespace-pre-line text-white/75">
                  {profile.bio}
                </p>
              ) : null}
            </div>
          </div>
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
                <VehicleCard key={v.id} vehicle={v} href={`/v/${v.id}`} tone="dark" />
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
                  <VehicleCard key={v.id} vehicle={v} href={`/v/${v.id}`} tone="dark" />
                ))}
              </VehicleGrid>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
