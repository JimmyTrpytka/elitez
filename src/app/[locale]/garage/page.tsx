import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { listMyVehicles } from "@/lib/data/vehicles";
import { PageShell } from "@/components/page-shell";
import { VehicleCard, VehicleGrid } from "@/components/garage/vehicle-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Garage");
  return { title: t("title"), robots: { index: false } };
}

export default async function GaragePage() {
  const [t, tAuth] = await Promise.all([
    getTranslations("Garage"),
    getTranslations("Auth"),
  ]);
  return (
    <PageShell
      width="lg"
      title={t("title")}
      subtitle={
        <Link href="/garage/archive" className={textLinkClass}>
          {t("archiveLink")}
        </Link>
      }
      actions={
        <Link href="/garage/new" className={buttonClasses("primary")}>
          {t("add")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <GarageContent />
      </Suspense>
    </PageShell>
  );
}

async function GarageContent() {
  const [t, locale, profile] = await Promise.all([
    getTranslations("Garage"),
    getLocale(),
    getMyProfile(),
  ]);
  if (!profile) return redirect({ href: "/login", locale });

  if (!profile.username) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert tone="info">{t("needsUsername")}</Alert>
        <Link href="/account/profile" className={buttonClasses("secondary")}>
          {t("finishProfile")}
        </Link>
      </div>
    );
  }

  const vehicles = await listMyVehicles("current");
  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-card bg-muted p-8">
        <p className="text-lg font-semibold text-ink">{t("emptyTitle")}</p>
        <p className="text-ink-soft">{t("emptyText")}</p>
        <Link href="/garage/new" className={buttonClasses("primary", "lg")}>
          {t("addFirst")}
        </Link>
      </div>
    );
  }

  return (
    <VehicleGrid>
      {vehicles.map((v) => (
        <VehicleCard key={v.id} vehicle={v} href={`/garage/${v.id}`} showVisibility />
      ))}
    </VehicleGrid>
  );
}
