import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { VehicleCardView } from "@/lib/data/vehicles";
import { cn } from "@/lib/cn";
import { TurboIcon } from "@/components/social/turbo-icon";

/** Karta vozidla se zmenšenou hlavní fotkou. */
export async function VehicleCard({
  vehicle,
  href,
  showVisibility = false,
  tone = "light",
  turbos,
}: {
  vehicle: VehicleCardView;
  href: string;
  showVisibility?: boolean;
  /** „dark“ pro tmavé výkladní stránky */
  tone?: "light" | "dark";
  /** Počet turb (zobrazí se přes fotku, když je > 0) */
  turbos?: number;
}) {
  const dark = tone === "dark";
  const t = await getTranslations("Vehicle");
  const tCommon = await getTranslations("Common");
  const title = `${vehicle.make} ${vehicle.model}`;
  const sold = vehicle.status === "former";
  const soldYear = vehicle.sold_on ? vehicle.sold_on.slice(0, 4) : null;

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card transition-all duration-500 hover:-translate-y-1",
        dark
          ? "bg-night-soft ring-1 ring-white/10 hover:shadow-[0_20px_60px_-24px_rgb(255_214_10/0.35)] hover:ring-accent/40"
          : "bg-muted hover:shadow-lg",
      )}
    >
      <div className={cn("relative aspect-[4/3] w-full overflow-hidden", dark ? "bg-white/5" : "bg-line")}>
        {vehicle.cover?.urls.md ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.cover.urls.md}
            alt={title}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-all duration-700 group-hover:scale-105",
              sold && "grayscale group-hover:grayscale-0",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-subtle">
            {t("noPhoto")}
          </div>
        )}
        {turbos ? (
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white tabular-nums backdrop-blur">
            <TurboIcon className="h-4 w-4 text-accent" />
            {turbos}
            <span className="sr-only">{tCommon("turbos", { count: turbos })}</span>
          </span>
        ) : null}
        {sold ? (
          <span className="absolute top-3 right-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-ink">
            {soldYear ? t("soldIn", { year: soldYear }) : t("soldBadge")}
          </span>
        ) : null}
        {showVisibility && vehicle.visibility === "private" ? (
          <span className="absolute top-3 left-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
            {tCommon("visibilityPrivate")}
          </span>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">
        <p
          className={cn(
            "font-display text-2xl leading-tight font-extrabold uppercase",
            dark ? "text-white" : "text-ink",
          )}
        >
          {title}
        </p>
        <p className={cn("mt-0.5 text-sm", dark ? "text-night-subtle" : "text-subtle")}>
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
