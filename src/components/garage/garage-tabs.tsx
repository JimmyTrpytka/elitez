import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { MyCounts } from "@/lib/data/account";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type GarageTab = "cars" | "dreams";

/**
 * Záložky garáže: Moje auta · Garáž snů · Předchozí auta (s počty)
 * a vpravo hlavní akce aktivní záložky.
 */
export async function GarageTabs({ active, counts }: { active: GarageTab; counts: MyCounts }) {
  const t = await getTranslations("Garage");
  const tabs: Array<{ key: GarageTab; href: string; label: string; count: number }> = [
    { key: "cars", href: "/garage", label: t("tabCars"), count: counts.vehicles + counts.former },
    { key: "dreams", href: "/garage/dreams", label: t("tabDreams"), count: counts.dreams },
  ];
  const action =
    active === "cars"
      ? { href: "/garage/new", label: t("add") }
      : active === "dreams"
        ? { href: "/garage/dreams/new", label: t("addDream") }
        : null;

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <nav
        aria-label={t("tabsLabel")}
        className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {tabs.map((tab) => {
            const current = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
                  current ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:bg-white hover:text-ink",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums",
                    current ? "bg-accent text-ink" : "bg-white text-ink-soft",
                  )}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="flex shrink-0 flex-wrap gap-2">
        {active === "cars" ? (
          <Link href="/garage/qr" className={buttonClasses("secondary")}>
            {t("qrSticker")}
          </Link>
        ) : null}
        {action ? (
          <Link href={action.href} className={buttonClasses("primary")}>
            + {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
