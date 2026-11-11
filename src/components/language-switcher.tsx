"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/** Přepínač CS / EN – zůstane na stejné stránce, jen změní jazyk. */
export function LanguageSwitcher() {
  const t = useTranslations("Nav");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("language")} className="flex rounded-full bg-white/10 p-1">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === current ? "true" : undefined}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors",
            locale === current
              ? "bg-white text-ink shadow-sm"
              : "text-white/60 hover:text-white",
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}
