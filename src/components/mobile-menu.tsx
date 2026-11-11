"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/cn";

/** Menu ☰ na telefonu: Eventy, Členové, přihlášení a přepínač jazyka. */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Po přechodu na jinou stránku menu zavřít
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Zavření klávesou Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const linkClass = (href: string) =>
    cn(
      "block rounded-control px-4 py-3 text-lg font-semibold",
      pathname.startsWith(href) ? "bg-muted text-ink" : "text-ink hover:bg-muted",
    );

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-muted"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-x-0 top-16 bottom-0 z-30 bg-ink/20"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-menu"
            aria-label={t("menu")}
            className="fixed inset-x-0 top-16 z-40 border-b border-line bg-surface px-4 pt-3 pb-5 shadow-lg"
          >
            <Link href="/events" className={linkClass("/events")}>
              {t("events")}
            </Link>
            <Link href="/members" className={linkClass("/members")}>
              {t("members")}
            </Link>
            {!signedIn ? (
              <Link href="/login" className={linkClass("/login")}>
                {t("login")}
              </Link>
            ) : null}
            <div className="mt-3 flex items-center justify-between border-t border-line px-4 pt-4">
              <span className="text-sm text-subtle">{t("language")}</span>
              <LanguageSwitcher />
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
