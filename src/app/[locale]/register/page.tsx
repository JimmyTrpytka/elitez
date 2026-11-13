import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { AuthShell, textLinkClass } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <>
          {t("registerHasAccount")}{" "}
          <Link href="/login" className={textLinkClass}>
            {t("registerLoginLink")}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RedirectSignedIn />
      </Suspense>
      <RegisterForm />
    </AuthShell>
  );
}

/** Přihlášený uživatel nový účet nezakládá – pošleme ho do jeho účtu. */
async function RedirectSignedIn() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (user) redirect({ href: "/account", locale });
  return null;
}
