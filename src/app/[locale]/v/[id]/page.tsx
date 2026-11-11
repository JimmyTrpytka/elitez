import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { getVehicle } from "@/lib/data/vehicles";
import { getCurrentUser } from "@/lib/auth/user";
import { getPhotoTurbos, getVehicleSocial, listTurboGivers } from "@/lib/data/social";
import { TurboGivers } from "@/components/social/turbo-givers";
import { isVehicleInMyDreams } from "@/lib/data/dreams";
import { WantButton } from "@/components/dreams/want-button";
import { hpToKw } from "@/lib/validation";
import { Alert } from "@/components/ui/alert";
import { HeroGallery } from "@/components/lightbox";
import { DisplayHeading } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PublicVehicle");
  return { title: t("metaTitle") };
}

export default async function PublicVehiclePage({ params }: PageProps<"/[locale]/v/[id]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-5xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <PublicVehicle params={params} />
    </Suspense>
  );
}

async function PublicVehicle({ params }: { params: PageProps<"/[locale]/v/[id]">["params"] }) {
  const { id } = await params;
  const [t, tVehicle, tMods, locale, vehicle] = await Promise.all([
    getTranslations("PublicVehicle"),
    getTranslations("Vehicle"),
    getTranslations("Mods"),
    getLocale(),
    getVehicle(id, ["md", "lg"]),
  ]);
  // RLS vrátí soukromé vozidlo jen majiteli
  if (!vehicle) notFound();
  const photoIds = vehicle.photos.map((p) => p.id);
  const [user, photoTurbos, social, givers, inMyDreams] = await Promise.all([
    getCurrentUser(),
    getPhotoTurbos(photoIds),
    getVehicleSocial([vehicle.id]),
    listTurboGivers({ vehicleId: vehicle.id }),
    isVehicleInMyDreams(vehicle.id),
  ]);
  const isOwner = user?.id === vehicle.owner_id;
  // Turba jen u veřejného vozidla (soukromé vidí jen majitel / pořadatel)
  const showTurbo = vehicle.visibility === "public";
  const turboMode = isOwner ? "own" : user ? "active" : "guest";
  const vehicleTurbos = social.get(vehicle.id)?.turbos ?? 0;

  const title = `${vehicle.make} ${vehicle.model}`;
  const specs: Array<[string, string]> = [
    [tVehicle("typeLabel"), tVehicle(`types.${vehicle.type}`)],
    [tVehicle("categoryLabel"), tVehicle(`categories.${vehicle.category}`)],
    ...(vehicle.year ? [[tVehicle("yearLabel"), String(vehicle.year)] as [string, string]] : []),
    ...(vehicle.engine ? [[tVehicle("engineLabel"), vehicle.engine] as [string, string]] : []),
    ...(vehicle.power_hp
      ? [[t("power"), `${vehicle.power_hp} k / ${hpToKw(vehicle.power_hp)} kW`] as [string, string]]
      : []),
    ...(vehicle.country
      ? [[tVehicle("countryLabel"), countryName(vehicle.country, locale)] as [string, string]]
      : []),
  ];

  return (
    <article className="flex-1 bg-night pb-20 text-night-text">
      <HeroGallery
        photos={vehicle.photos.map((p) => ({ id: p.id, thumb: p.urls.md ?? null, full: p.urls.lg ?? p.urls.md ?? null }))}
        alt={title}
        galleryTitle={t("gallery")}
        turbo={
          showTurbo
            ? {
                mode: turboMode,
                initial: Object.fromEntries(
                  photoIds.map((id) => {
                    const s = photoTurbos.get(id);
                    return [id, { given: s?.mine ?? false, count: s?.count ?? 0 }];
                  }),
                ),
              }
            : undefined
        }
        overlay={
          <>
            {vehicle.status === "former" ? (
              <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
                {t("former")}
              </p>
            ) : null}
            <DisplayHeading as="h1" size="lg" className="text-white">
              {title}
            </DisplayHeading>
            {vehicle.owner?.username ? (
              <p className="mt-3 text-white/75">
                {t("ownedBy")}{" "}
                <Link
                  href={`/u/${vehicle.owner.username}`}
                  className="font-semibold text-white underline decoration-accent decoration-2 underline-offset-4"
                >
                  {vehicle.owner.display_name ?? `@${vehicle.owner.username}`}
                </Link>
              </p>
            ) : null}
          </>
        }
      >
        {isOwner ? (
          <div className="mb-6 flex flex-col gap-3">
            {vehicle.visibility === "private" ? (
              <Alert tone="info">{t("ownerPrivateNotice")}</Alert>
            ) : null}
            <div>
              <Link href={`/garage/${vehicle.id}`} className={buttonClasses("light")}>
                {t("manage")}
              </Link>
            </div>
          </div>
        ) : null}

        {showTurbo ? (
          <div className="mb-8">
            <WantButton
              vehicleId={vehicle.id}
              mode={turboMode}
              initialWanted={inMyDreams}
              initialDreamers={social.get(vehicle.id)?.dreamers ?? 0}
            />
          </div>
        ) : null}
        {showTurbo && vehicleTurbos > 0 && givers.length > 0 ? (
          <div className="mb-8">
            <TurboGivers givers={givers} />
          </div>
        ) : null}
        {showTurbo && vehicle.photos.length === 0 && !isOwner ? (
          <p className="mb-8 text-sm text-night-subtle">{t("noPhotosForTurbo")}</p>
        ) : null}

        {vehicle.description ? (
          <p className="mb-10 max-w-3xl text-lg leading-relaxed whitespace-pre-line text-white/80">
            {vehicle.description}
          </p>
        ) : null}

        <dl className="mb-12 grid grid-cols-2 gap-x-8 gap-y-6 border-y border-white/10 py-8 sm:grid-cols-3">
          {specs.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold tracking-[0.18em] text-night-subtle uppercase">{label}</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>

        {vehicle.story ? (
          <section className="mb-12">
            <h2 className="mb-4 font-display text-3xl font-extrabold text-white uppercase">{t("story")}</h2>
            <p className="max-w-3xl leading-relaxed whitespace-pre-line text-white/75">
              {vehicle.story}
            </p>
          </section>
        ) : null}

        {vehicle.mods.length ? (
          <section className="mb-12">
            <h2 className="mb-4 font-display text-3xl font-extrabold text-white uppercase">{t("mods")}</h2>
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {vehicle.mods.map((m) => (
                <li key={m.id} className="flex gap-4 py-4">
                  <span className="w-32 shrink-0 text-xs font-semibold tracking-[0.15em] text-accent uppercase">
                    {tMods(`categories.${m.category}`)}
                  </span>
                  <span className="text-white/85">{m.description}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

      </HeroGallery>
    </article>
  );
}
