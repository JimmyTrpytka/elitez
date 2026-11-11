"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** Pruh „Testovací verze“ s odkazem na připomínky (zapamatuje si, odkud tester přišel). */
export function BetaBanner() {
  const t = useTranslations("Beta");
  const pathname = usePathname();
  const from = pathname.startsWith("/feedback") ? "" : pathname;
  return (
    <div className="bg-ink text-white print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs sm:px-6 sm:text-sm">
        <span>
          <span className="font-semibold text-accent">{t("label")}</span> · {t("text")}
        </span>
        <Link
          href={{ pathname: "/feedback", query: from ? { from } : {} }}
          className="font-semibold text-accent underline underline-offset-4"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}

/** Varianta bez aktuální adresy (než se načte). */
export function BetaBannerFallback() {
  return <div className="h-8 bg-ink print:hidden sm:h-9" aria-hidden />;
}
