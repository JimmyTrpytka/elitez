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
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {isOwner && profile.visibility === "private" ? (
        <div className="mb-6">
          <Alert tone="info">{t("ownerPrivateNotice")}</Alert>
        </div>
      ) : null}

      <header className="mb-12 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar url={profile.avatarUrl} name={name} size={112} />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
            {profile.verified_at ? <Badge>Verified</Badge> : null}
          </div>
          <p className="mt-1 text-subtle">
            @{profile.username}
            {place ? ` · ${place}` : ""}
          </p>
          {profile.bio ? (
            <p className="mt-3 max-w-2xl whitespace-pre-line text-ink-soft">{profile.bio}</p>
          ) : null}
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("garageTitle")}</h2>
        {current.length ? (
          <VehicleGrid>
            {current.map((v) => (
              <VehicleCard key={v.id} vehicle={v} href={`/v/${v.id}`} />
            ))}
          </VehicleGrid>
        ) : (
          <p className="text-ink-soft">{t("garageEmpty")}</p>
        )}
      </section>

      {former.length ? (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-semibold">{t("formerTitle")}</h2>
          <VehicleGrid>
            {former.map((v) => (
              <VehicleCard key={v.id} vehicle={v} href={`/v/${v.id}`} />
            ))}
          </VehicleGrid>
        </section>
      ) : null}
    </div>
  );
}
