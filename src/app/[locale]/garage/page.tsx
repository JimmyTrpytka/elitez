import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { getMyCounts } from "@/lib/data/account";
import { listMyVehicles } from "@/lib/data/vehicles";
import { getVehicleSocial } from "@/lib/data/social";
import { PageShell } from "@/components/page-shell";
import { GarageTabs } from "@/components/garage/garage-tabs";
import { VehicleCard, VehicleGrid } from "@/components/garage/vehicle-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Garage");
  return { title: t("title"), robots: { index: false } };
}

export default async function GaragePage() {
  const [t, tAuth] = await Promise.all([getTranslations("Garage"), getTranslations("Auth")]);
  return (
    <PageShell width="lg" title={t("title")}>
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

  const [vehicles, former, counts] = await Promise.all([
    listMyVehicles("current"),
    listMyVehicles("former"),
    getMyCounts(),
  ]);
  const social = await getVehicleSocial([...vehicles, ...former].map((v) => v.id));

  return (
    <>
      <GarageTabs active="cars" counts={counts} />
      {vehicles.length === 0 && former.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-card bg-muted p-8">
          <p className="text-lg font-semibold text-ink">{t("emptyTitle")}</p>
          <p className="text-ink-soft">{t("emptyText")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/garage/new" className={buttonClasses("primary", "lg")}>
              {t("addFirst")}
            </Link>
            <Link href="/garage/dreams" className={buttonClasses("secondary", "lg")}>
              {t("noCarDreams")}
            </Link>
          </div>
          <p className="text-sm text-subtle">{t("fanHint")}</p>
        </div>
      ) : vehicles.length === 0 ? null : (
        <VehicleGrid>
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              href={`/garage/${v.id}`}
              showVisibility
              turbos={social.get(v.id)?.turbos}
            />
          ))}
        </VehicleGrid>
      )}

      {/* Prodaná auta – na předchozí projekty jsou lidé hrdí */}
      {former.length ? (
        <section id="prodana" className="mt-12 scroll-mt-24">
          <h2 className="mb-1 font-display text-3xl font-extrabold text-ink uppercase">{t("formerSection")}</h2>
          <p className="mb-5 text-sm text-subtle">{t("formerSectionHint")}</p>
          <VehicleGrid>
            {former.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                href={`/garage/${v.id}`}
                showVisibility
                turbos={social.get(v.id)?.turbos}
              />
            ))}
          </VehicleGrid>
        </section>
      ) : null}
    </>
  );
}
