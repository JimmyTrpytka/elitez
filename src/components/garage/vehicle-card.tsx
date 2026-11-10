import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { VehicleCardView } from "@/lib/data/vehicles";

/** Karta vozidla se zmenšenou hlavní fotkou. */
export async function VehicleCard({
  vehicle,
  href,
  showVisibility = false,
}: {
  vehicle: VehicleCardView;
  href: string;
  showVisibility?: boolean;
}) {
  const t = await getTranslations("Vehicle");
  const tCommon = await getTranslations("Common");
  const title = `${vehicle.make} ${vehicle.model}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-card bg-muted transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-line">
        {vehicle.cover?.urls.md ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.cover.urls.md}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-subtle">
            {t("noPhoto")}
          </div>
        )}
        {showVisibility && vehicle.visibility === "private" ? (
          <span className="absolute top-3 left-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
            {tCommon("visibilityPrivate")}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-lg font-semibold text-ink">{title}</p>
        <p className="text-sm text-subtle">
          {[vehicle.year, t(`categories.${vehicle.category}`)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}

export function VehicleGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
