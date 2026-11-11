import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { listMyVehicles } from "@/lib/data/vehicles";
import { PageShell } from "@/components/page-shell";
import { QrSticker, type QrTarget } from "@/components/garage/qr-sticker";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Qr");
  return { title: t("title"), robots: { index: false } };
}

/** Veřejná adresa webu (QR musí vést na ostrý web, ne na localhost). */
function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return (url && !url.includes("localhost") ? url : "https://www.elitezclub.eu").replace(/\/+$/, "");
}

export default async function QrPage() {
  const [t, tGarage, tAuth] = await Promise.all([
    getTranslations("Qr"),
    getTranslations("Garage"),
    getTranslations("Auth"),
  ]);
  return (
    <PageShell
      width="lg"
      title={t("title")}
      subtitle={
        <Link href="/garage" className={textLinkClass}>
          {tGarage("backToGarage")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <QrContent />
      </Suspense>
    </PageShell>
  );
}

async function QrContent() {
  const [t, locale, profile] = await Promise.all([getTranslations("Qr"), getLocale(), getMyProfile()]);
  if (!profile) return redirect({ href: "/login", locale });
  if (!profile.username) return redirect({ href: "/garage", locale });

  const base = `${siteUrl()}/${locale}`;
  const vehicles = (await listMyVehicles("current")).filter((v) => v.visibility === "public");
  const targets: QrTarget[] = [
    {
      id: "garage",
      label: t("targetGarage"),
      title: t("garageTitle"),
      url: `${base}/u/${profile.username}`,
    },
    ...vehicles.map((v) => ({
      id: v.id,
      label: `${v.make} ${v.model}`,
      title: `${v.make} ${v.model}`,
      url: `${base}/v/${v.id}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {profile.visibility === "private" ? (
        <p className="rounded-card bg-muted p-5 text-ink-soft">{t("privateWarning")}</p>
      ) : null}
      <p className="max-w-2xl text-ink-soft print:hidden">{t("intro")}</p>
      <QrSticker targets={targets} username={profile.username} />
    </div>
  );
}
