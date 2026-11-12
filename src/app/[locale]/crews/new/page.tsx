import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/data/profiles";
import { listMyFoundedCrews } from "@/lib/data/crews";
import { PageShell } from "@/components/page-shell";
import { CrewCreateForm } from "@/components/crews/crew-create-form";
import { Alert } from "@/components/ui/alert";
import { textLinkClass } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Crews");
  return { title: t("newTitle"), robots: { index: false } };
}

export default async function NewCrewPage() {
  const [t, tAuth] = await Promise.all([getTranslations("Crews"), getTranslations("Auth")]);
  return (
    <PageShell
      title={t("newTitle")}
      subtitle={
        <Link href="/crews" className={textLinkClass}>
          {t("backToCrews")}
        </Link>
      }
    >
      <Suspense fallback={<p className="text-subtle">{tAuth("loading")}</p>}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const [t, locale, profile] = await Promise.all([getTranslations("Crews"), getLocale(), getMyProfile()]);
  if (!profile) return redirect({ href: "/login", locale });
  if (!profile.verified_at || !profile.username) {
    return <Alert tone="info">{t("createVerifiedOnly")}</Alert>;
  }
  const founded = await listMyFoundedCrews();
  const pending = founded.find((c) => c.status === "pending");
  if (pending) {
    return (
      <Alert tone="info">
        {t("pendingExistsText", { name: pending.name })}{" "}
        <Link href={`/c/${pending.slug}`} className={textLinkClass}>
          {t("openCrew")}
        </Link>
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-soft">{t("newIntro")}</p>
      <CrewCreateForm />
    </div>
  );
}
