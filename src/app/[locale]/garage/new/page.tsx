import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { PageShell } from "@/components/page-shell";
import { VehicleForm } from "@/components/garage/vehicle-form";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Vehicle");
  return { title: t("newTitle"), robots: { index: false } };
}

export default async function NewVehiclePage() {
  const [t, tGarage, tAuth] = await Promise.all([
    getTranslations("Vehicle"),
    getTranslations("Garage"),
    getTranslations("Auth"),
  ]);
  return (
    <PageShell
      title={t("newTitle")}
      subtitle={
        <Link href="/garage" className={textLinkClass}>
          {tGarage("backToGarage")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <NewVehicleContent />
      </Suspense>
    </PageShell>
  );
}

async function NewVehicleContent() {
  const [locale, profile] = await Promise.all([getLocale(), getMyProfile()]);
  if (!profile) return redirect({ href: "/login", locale });
  if (!profile.username) return redirect({ href: "/garage", locale });

  return (
    <VehicleForm
      values={{
        type: "car",
        category: "tuning",
        make: "",
        model: "",
        year: "",
        engine: "",
        power_hp: "",
        description: "",
        story: "",
        country: profile.country ?? "",
        acquired_on: "",
        visibility: "public",
      }}
    />
  );
}
