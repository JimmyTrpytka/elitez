import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listMyVehicles } from "@/lib/data/vehicles";
import { PageShell } from "@/components/page-shell";
import { VehicleCard, VehicleGrid } from "@/components/garage/vehicle-card";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Garage");
  return { title: t("archiveTitle"), robots: { index: false } };
}

export default async function ArchivePage() {
  const [t, tAuth] = await Promise.all([
    getTranslations("Garage"),
    getTranslations("Auth"),
  ]);
  return (
    <PageShell
      width="lg"
      title={t("archiveTitle")}
      subtitle={
        <Link href="/garage" className={textLinkClass}>
          {t("backToGarage")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <ArchiveContent />
      </Suspense>
    </PageShell>
  );
}

async function ArchiveContent() {
  const t = await getTranslations("Garage");
  const vehicles = await listMyVehicles("former");
  if (vehicles.length === 0) {
    return <p className="text-ink-soft">{t("archiveEmpty")}</p>;
  }
  return (
    <VehicleGrid>
      {vehicles.map((v) => (
        <VehicleCard key={v.id} vehicle={v} href={`/garage/${v.id}`} showVisibility />
      ))}
    </VehicleGrid>
  );
}
