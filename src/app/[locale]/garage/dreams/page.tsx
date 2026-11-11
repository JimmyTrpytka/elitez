import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { listDreamsOfOwner } from "@/lib/data/dreams";
import { PageShell } from "@/components/page-shell";
import { DreamCard } from "@/components/dreams/dream-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dreams");
  return { title: t("title"), robots: { index: false } };
}

export default async function DreamsPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Dreams"), getTranslations("Auth")]);
  return (
    <PageShell
      width="lg"
      title={t("title")}
      subtitle={
        <Link href="/garage" className={textLinkClass}>
          {t("backToGarage")}
        </Link>
      }
      actions={
        <Link href="/garage/dreams/new" className={buttonClasses("primary")}>
          {t("add")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <DreamsContent />
      </Suspense>
    </PageShell>
  );
}

async function DreamsContent() {
  const [t, tGarage, locale, profile] = await Promise.all([
    getTranslations("Dreams"),
    getTranslations("Garage"),
    getLocale(),
    getMyProfile(),
  ]);
  if (!profile) return redirect({ href: "/login", locale });
  if (!profile.username) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert tone="info">{tGarage("needsUsername")}</Alert>
        <Link href="/account/profile" className={buttonClasses("secondary")}>
          {tGarage("finishProfile")}
        </Link>
      </div>
    );
  }

  const dreams = await listDreamsOfOwner(profile.id);
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-ink-soft">{t("intro")}</p>
      {dreams.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-card bg-muted p-8">
          <p className="text-lg font-semibold text-ink">{t("emptyTitle")}</p>
          <p className="text-ink-soft">{t("emptyText")}</p>
          <Link href="/garage/dreams/new" className={buttonClasses("primary", "lg")}>
            {t("addFirst")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dreams.map((d) => (
            <DreamCard key={d.id} dream={d} href={`/garage/dreams/${d.id}/edit`} showVisibility />
          ))}
        </div>
      )}
    </div>
  );
}
