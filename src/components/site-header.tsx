import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { buttonClasses } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={t("home")} className="flex items-center">
          <Logo />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Přepínač čte aktuální adresu – na stránkách s ID se zjistí až při požadavku */}
          <Suspense fallback={<div className="h-8 w-[76px] rounded-full bg-muted" aria-hidden />}>
            <LanguageSwitcher />
          </Suspense>
          {/* Stav přihlášení se čte při každém požadavku, proto je v Suspense */}
          <Suspense fallback={<div className="h-11 w-28" aria-hidden />}>
            <AuthLinks />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function AuthLinks() {
  const [t, user] = await Promise.all([
    getTranslations("Nav"),
    getCurrentUser(),
  ]);

  if (user) {
    return (
      <Link href="/account" className={buttonClasses("secondary")}>
        {t("account")}
      </Link>
    );
  }
  return (
    <>
      <Link
        href="/login"
        className={buttonClasses("ghost", "md", "max-sm:hidden")}
      >
        {t("login")}
      </Link>
      <Link href="/register" className={buttonClasses("primary")}>
        {t("register")}
      </Link>
    </>
  );
}
