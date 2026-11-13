import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { listPortfolio } from "@/lib/data/portfolio";
import { listMyMediaRequests } from "@/lib/data/media";
import { PageShell } from "@/components/page-shell";
import { PortfolioManager } from "@/components/portfolio/portfolio-manager";
import { buttonClasses } from "@/components/ui/button";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Portfolio");
  return { title: t("manageTitle"), robots: { index: false } };
}

export default async function PortfolioPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Portfolio"), getTranslations("Auth")]);
  return (
    <PageShell
      title={t("manageTitle")}
      subtitle={
        <Link href="/account" className={textLinkClass}>
          {t("backToAccount")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const [t, locale, profile] = await Promise.all([getTranslations("Portfolio"), getLocale(), getMyProfile()]);
  if (!profile) return redirect({ href: "/login", locale });

  if (!profile.is_creator) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-card bg-muted p-6 sm:p-8">
        <p className="font-display text-3xl font-extrabold text-ink uppercase">{t("notCreatorTitle")}</p>
        <p className="max-w-xl text-ink-soft">{t("notCreatorText")}</p>
        <Link href="/account/profile" className={buttonClasses("primary")}>
          {t("becomeCreator")}
        </Link>
      </div>
    );
  }

  const [{ items }, mediaRequests] = await Promise.all([listPortfolio(profile.id, "all"), listMyMediaRequests()]);
  const mediaEvents = mediaRequests
    .filter((r) => r.status === "approved" && r.event)
    .map((r) => ({ id: r.event_id, title: r.event!.title }));
  return (
    <div className="flex flex-col gap-8">
      {profile.username ? (
        <p>
          <Link href={`/u/${profile.username}#portfolio`} className={textLinkClass}>
            {t("viewOnProfile")} →
          </Link>
        </p>
      ) : null}
      <PortfolioManager userId={profile.id} items={items} mediaEvents={mediaEvents} />
    </div>
  );
}
