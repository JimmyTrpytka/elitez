import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getVehicle, isMyVehicle } from "@/lib/data/vehicles";
import { PageShell } from "@/components/page-shell";
import { PhotoManager } from "@/components/garage/photo-manager";
import { ModsManager } from "@/components/garage/mods-manager";
import { VehicleSettings } from "@/components/garage/vehicle-settings";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Garage");
  return { title: t("manageTitle"), robots: { index: false } };
}

export default async function ManageVehiclePage({
  params,
}: PageProps<"/[locale]/garage/[id]">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-4xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <ManageVehicle params={params} />
    </Suspense>
  );
}

async function ManageVehicle({
  params,
}: {
  params: PageProps<"/[locale]/garage/[id]">["params"];
}) {
  const { id } = await params;
  const [t, vehicle] = await Promise.all([
    getTranslations("Garage"),
    getVehicle(id, ["sm"]),
  ]);
  // Spravovat smí jen majitel (ostatní dostanou „nenalezeno“)
  if (!vehicle || !(await isMyVehicle(vehicle))) notFound();

  const title = `${vehicle.make} ${vehicle.model}`;

  return (
    <PageShell
      title={title}
      subtitle={
        <Link
          href={vehicle.status === "former" ? "/garage/archive" : "/garage"}
          className={textLinkClass}
        >
          {vehicle.status === "former" ? t("backToArchive") : t("backToGarage")}
        </Link>
      }
      actions={
        <>
          <Link href={`/garage/${vehicle.id}/edit`} className={buttonClasses("secondary")}>
            {t("editDetails")}
          </Link>
          <Link href={`/v/${vehicle.id}`} className={buttonClasses("ghost")}>
            {t("viewPublic")}
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("photosTitle")}</h2>
          <PhotoManager vehicleId={vehicle.id} photos={vehicle.photos} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("modsTitle")}</h2>
          <ModsManager vehicleId={vehicle.id} mods={vehicle.mods} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t("settingsTitle")}</h2>
          <VehicleSettings
            vehicleId={vehicle.id}
            visibility={vehicle.visibility}
            status={vehicle.status}
          />
        </Card>
      </div>
    </PageShell>
  );
}
