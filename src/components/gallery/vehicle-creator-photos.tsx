import { getTranslations } from "next-intl/server";
import { listVehicleCreatorWorks } from "@/lib/data/gallery";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { getCurrentUser } from "@/lib/auth/user";
import { getPortfolioTurbos } from "@/lib/data/social";
import { UntagButton } from "./untag-button";

/** „Fotky od creatorů“ na stránce auta; majitel může označení odebrat. */
export async function VehicleCreatorPhotos({
  vehicleId,
  alt,
  isOwner,
}: {
  vehicleId: string;
  alt: string;
  isOwner: boolean;
}) {
  const [t, items] = await Promise.all([getTranslations("Gallery"), listVehicleCreatorWorks(vehicleId)]);
  if (!items.length) return null;
  const [user, turbos] = await Promise.all([getCurrentUser(), getPortfolioTurbos(items.map((i) => i.id))]);
  return (
    <section className="mb-12">
      <h2 className="mb-2 font-display text-3xl font-extrabold text-white uppercase">{t("vehicleTitle")}</h2>
      <p className="mb-6 text-night-subtle">{t("vehicleIntro")}</p>
      <PortfolioGallery
        items={items}
        alt={alt}
        turbo={{ mode: user ? "active" : "guest", viewerId: user?.id ?? null, initial: turbos }}
      />
      {isOwner ? (
        <div className="mt-6 rounded-card bg-night-soft p-4">
          <p className="mb-2 text-sm text-night-subtle">{t("ownerUntagHint")}</p>
          <ul className="flex flex-col gap-2">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-white">
                <span>
                  📸 {i.credit?.name ?? "—"}
                  {i.caption ? ` · ${i.caption}` : ""}
                </span>
                <UntagButton itemId={i.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
