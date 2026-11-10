import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getVehicle, isMyVehicle } from "@/lib/data/vehicles";
import { PageShell } from "@/components/page-shell";
import { VehicleForm } from "@/components/garage/vehicle-form";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Vehicle");
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditVehiclePage({
  params,
}: PageProps<"/[locale]/garage/[id]/edit">) {
  const tAuth = await getTranslations("Auth");
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-2xl px-4 py-14 text-subtle">{tAuth("loading")}</p>}
    >
      <EditVehicle params={params} />
    </Suspense>
  );
}

async function EditVehicle({
  params,
}: {
  params: PageProps<"/[locale]/garage/[id]/edit">["params"];
}) {
  const { id } = await params;
  const [t, tGarage, vehicle] = await Promise.all([
    getTranslations("Vehicle"),
    getTranslations("Garage"),
    getVehicle(id, []),
  ]);
  if (!vehicle || !(await isMyVehicle(vehicle))) notFound();

  return (
    <PageShell
      title={t("editTitle")}
      subtitle={
        <Link href={`/garage/${vehicle.id}`} className={textLinkClass}>
          {tGarage("backToVehicle")}
        </Link>
      }
    >
      <VehicleForm
        values={{
          id: vehicle.id,
          type: vehicle.type,
          category: vehicle.category,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year?.toString() ?? "",
          engine: vehicle.engine ?? "",
          power_hp: vehicle.power_hp?.toString() ?? "",
          description: vehicle.description ?? "",
          story: vehicle.story ?? "",
          country: vehicle.country ?? "",
          acquired_on: vehicle.acquired_on ?? "",
          visibility: vehicle.visibility,
        }}
      />
    </PageShell>
  );
}
