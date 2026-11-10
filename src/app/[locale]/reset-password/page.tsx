import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("resetTitle") };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      <Suspense fallback={<p className="text-subtle">{t("loading")}</p>}>
        <ResetContent />
      </Suspense>
    </AuthShell>
  );
}

/** Nové heslo jde nastavit jen po otevření odkazu z e-mailu (ten uživatele přihlásí). */
async function ResetContent() {
  const [t, user] = await Promise.all([
    getTranslations("Auth"),
    getCurrentUser(),
  ]);
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="info">{t("resetNeedsLink")}</Alert>
        <Link href="/forgot-password" className={buttonClasses("secondary", "lg")}>
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm />;
}
