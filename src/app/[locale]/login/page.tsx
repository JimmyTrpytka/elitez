import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell, textLinkClass } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({
  searchParams,
}: PageProps<"/[locale]/login">) {
  const t = await getTranslations("Auth");
  return (
    <AuthShell
      title={t("loginTitle")}
      footer={
        <>
          {t("loginNoAccount")}{" "}
          <Link href="/register" className={textLinkClass}>
            {t("loginRegisterLink")}
          </Link>
        </>
      }
    >
      {/* Parametry adresy (?error=link) se čtou až při požadavku */}
      <Suspense fallback={<LoginForm linkError={false} />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/login">["searchParams"];
}) {
  const { error } = await searchParams;
  return <LoginForm linkError={error === "link"} />;
}
