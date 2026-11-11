import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/lib/site-config";
import { Logo } from "@/components/logo";
import { buttonClasses } from "@/components/ui/button";

/** Velká patička: o klubu, mapa webu, informace a kontakt. */
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const year = 2026;

  const columns: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
    {
      title: t("colClub"),
      links: [
        { href: "/", label: t("home") },
        { href: "/events", label: t("events") },
        { href: "/members", label: t("members") },
        { href: "/register", label: t("register") },
      ],
    },
    {
      title: t("colAccount"),
      links: [
        { href: "/account", label: t("account") },
        { href: "/garage", label: t("garage") },
        { href: "/account/registrations", label: t("registrations") },
        { href: "/account/notifications", label: t("notifications") },
      ],
    },
    {
      title: t("colInfo"),
      links: [
        { href: "/privacy", label: t("privacy") },
        { href: "/feedback", label: t("feedback") },
      ],
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-night text-night-subtle print:hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-16 pb-10 sm:px-6 lg:grid-cols-[1.3fr_2fr]">
        <div className="flex flex-col items-start gap-5">
          <Logo dark />
          <p className="max-w-sm text-sm leading-relaxed">{t("about")}</p>
          <Link href="/register" className={buttonClasses("primary")}>
            {t("cta")}
          </Link>
        </div>

        <nav aria-label={t("sitemap")} className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title}>
              <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-white uppercase">
                {col.title}
              </p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-3">
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-white uppercase">
              {t("contactTitle")}
            </p>
            <p className="text-sm">
              {SITE.operator.email ? (
                <a href={`mailto:${SITE.operator.email}`} className="hover:text-white">
                  {SITE.operator.email}
                </a>
              ) : (
                <>
                  {t("contactViaForm")}{" "}
                  <Link
                    href="/feedback"
                    className="text-white underline decoration-accent decoration-2 underline-offset-4"
                  >
                    {t("feedback")}
                  </Link>
                </>
              )}
            </p>
          </div>
        </nav>
      </div>

      {/* Velký nápis značky */}
      <div aria-hidden className="pointer-events-none mx-auto w-full max-w-6xl px-4 select-none sm:px-6">
        <p className="font-display text-[22vw] leading-[0.8] font-extrabold tracking-tight text-white/[0.04] lg:text-[15rem]">
          ELITEZ
        </p>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © {year} ELITEZ · {t("tagline")}
          </span>
          <span>elitezclub.eu</span>
        </div>
      </div>
    </footer>
  );
}
