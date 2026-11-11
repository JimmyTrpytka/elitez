import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { BellIcon, UserIcon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/mobile-menu";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-night/80 text-night-text backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" aria-label={t("home")} className="flex items-center">
          <Logo dark />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <nav aria-label={t("menu")} className="hidden items-center gap-1 sm:flex">
            <Link
              href="/events"
              className="rounded-full px-3 py-2 text-sm font-semibold text-night-text/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              {t("events")}
            </Link>
            <Link
              href="/members"
              className="rounded-full px-3 py-2 text-sm font-semibold text-night-text/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              {t("members")}
            </Link>
          </nav>
          {/* Přepínač čte aktuální adresu – na stránkách s ID se zjistí až při požadavku */}
          <div className="hidden sm:block">
            <Suspense fallback={<div className="h-8 w-[76px] rounded-full bg-white/10" aria-hidden />}>
              <LanguageSwitcher />
            </Suspense>
          </div>
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
    const unread = await getUnreadNotificationCount();
    return (
      <>
        <Link
          href="/account/notifications"
          aria-label={
            unread ? t("notificationsUnread", { count: unread }) : t("notifications")
          }
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
        >
          <BellIcon />
          {unread ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
        <Link
          href="/account"
          aria-label={t("account")}
          className={buttonClasses("light", "md", "max-sm:h-10 max-sm:w-10 max-sm:px-0")}
        >
          <UserIcon className="h-5 w-5 sm:hidden" />
          <span className="max-sm:hidden">{t("account")}</span>
        </Link>
        <MobileMenu signedIn />
      </>
    );
  }
  return (
    <>
      <Link
        href="/login"
        className={buttonClasses("ghost", "md", "text-white hover:bg-white/10 max-sm:hidden")}
      >
        {t("login")}
      </Link>
      <Link href="/register" className={buttonClasses("primary", "md", "max-sm:h-10 max-sm:px-3.5")}>
        {t("register")}
      </Link>
      <MobileMenu signedIn={false} />
    </>
  );
}
