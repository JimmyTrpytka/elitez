import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { getVehicle, isMyVehicle } from "@/lib/data/vehicles";
import { hpToKw } from "@/lib/validation";
import { Alert } from "@/components/ui/alert";
import { HeroGallery } from "@/components/lightbox";
import { buttonClasses } from "@/components/ui/button";
import { textLinkClass } from "@/components/auth/auth-shell";

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
  const isOwner = await isMyVehicle(vehicle);

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
    <article className="pb-20">
      <HeroGallery
        photos={vehicle.photos.map((p) => ({ id: p.id, thumb: p.urls.md ?? null, full: p.urls.lg ?? p.urls.md ?? null }))}
        alt={title}
        galleryTitle={t("gallery")}
      >
        {isOwner ? (
          <div className="mb-6 flex flex-col gap-3">
            {vehicle.visibility === "private" ? (
              <Alert tone="info">{t("ownerPrivateNotice")}</Alert>
            ) : null}
            <div>
              <Link href={`/garage/${vehicle.id}`} className={buttonClasses("secondary")}>
                {t("manage")}
              </Link>
            </div>
          </div>
        ) : null}

        <header className="mb-10">
          {vehicle.status === "former" ? (
            <p className="mb-2 text-sm font-semibold tracking-[0.15em] text-subtle uppercase">
              {t("former")}
            </p>
          ) : null}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          {vehicle.owner?.username ? (
            <p className="mt-3 text-ink-soft">
              {t("ownedBy")}{" "}
              <Link href={`/u/${vehicle.owner.username}`} className={textLinkClass}>
                {vehicle.owner.display_name ?? `@${vehicle.owner.username}`}
              </Link>
            </p>
          ) : null}
          {vehicle.description ? (
            <p className="mt-5 max-w-3xl text-lg whitespace-pre-line text-ink-soft">
              {vehicle.description}
            </p>
          ) : null}
        </header>

        <dl className="mb-12 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-6 sm:grid-cols-3">
          {specs.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-subtle">{label}</dt>
              <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {vehicle.story ? (
          <section className="mb-12">
            <h2 className="mb-3 text-xl font-semibold">{t("story")}</h2>
            <p className="max-w-3xl leading-relaxed whitespace-pre-line text-ink-soft">
              {vehicle.story}
            </p>
          </section>
        ) : null}

        {vehicle.mods.length ? (
          <section className="mb-12">
            <h2 className="mb-3 text-xl font-semibold">{t("mods")}</h2>
            <ul className="divide-y divide-line rounded-control border border-line">
              {vehicle.mods.map((m) => (
                <li key={m.id} className="flex gap-4 px-4 py-3">
                  <span className="w-32 shrink-0 text-sm text-subtle">
                    {tMods(`categories.${m.category}`)}
                  </span>
                  <span className="text-ink">{m.description}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

      </HeroGallery>
    </article>
  );
}
