import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { PageShell } from "@/components/page-shell";
import { DreamForm } from "@/components/dreams/dream-form";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dreams");
  return { title: t("newTitle"), robots: { index: false } };
}

export default async function NewDreamPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Dreams"), getTranslations("Auth")]);
  return (
    <PageShell
      title={t("newTitle")}
      subtitle={
        <Link href="/garage/dreams" className={textLinkClass}>
          {t("backToDreams")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <NewDreamContent />
      </Suspense>
    </PageShell>
  );
}

async function NewDreamContent() {
  const [locale, profile] = await Promise.all([getLocale(), getMyProfile()]);
  if (!profile) return redirect({ href: "/login", locale });
  if (!profile.username) return redirect({ href: "/garage/dreams", locale });
  return (
    <DreamForm
      values={{ make: "", model: "", year_from: "", year_to: "", note: "", status: "dreaming", visibility: "public" }}
    />
  );
}
