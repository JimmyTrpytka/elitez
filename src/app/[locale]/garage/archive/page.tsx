import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { getMyCounts } from "@/lib/data/account";
import { listMyVehicles } from "@/lib/data/vehicles";
import { PageShell } from "@/components/page-shell";
import { GarageTabs } from "@/components/garage/garage-tabs";
import { VehicleCard, VehicleGrid } from "@/components/garage/vehicle-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Garage");
  return { title: t("tabFormer"), robots: { index: false } };
}

export default async function ArchivePage() {
  const [t, tAuth] = await Promise.all([getTranslations("Garage"), getTranslations("Auth")]);
  return (
    <PageShell width="lg" title={t("title")}>
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <ArchiveContent />
      </Suspense>
    </PageShell>
  );
}

async function ArchiveContent() {
  const [t, locale, user] = await Promise.all([getTranslations("Garage"), getLocale(), getCurrentUser()]);
  if (!user) return redirect({ href: "/login", locale });
  const [vehicles, counts] = await Promise.all([listMyVehicles("former"), getMyCounts()]);
  return (
    <>
      <GarageTabs active="former" counts={counts} />
      {vehicles.length === 0 ? (
        <p className="rounded-card bg-muted p-8 text-ink-soft">{t("archiveEmpty")}</p>
      ) : (
        <VehicleGrid>
          {vehicles.map((v) => (
            <VehicleCard key={v.id} vehicle={v} href={`/garage/${v.id}`} showVisibility />
          ))}
        </VehicleGrid>
      )}
    </>
  );
}
