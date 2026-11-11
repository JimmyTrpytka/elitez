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
      "block rounded-control px-4 py-3 font-bold",
      pathname.startsWith(href) ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/10",
    );

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-x-0 top-16 bottom-0 z-30 bg-black/50 backdrop-blur-sm"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-menu"
            aria-label={t("menu")}
            className="fixed inset-x-0 top-16 z-40 border-b border-white/10 bg-night px-4 pt-3 pb-5 font-display text-2xl tracking-wide uppercase shadow-2xl"
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
            <div className="mt-3 flex items-center justify-between border-t border-white/10 px-4 pt-4 font-sans normal-case tracking-normal">
              <span className="text-sm text-night-subtle">{t("language")}</span>
              <LanguageSwitcher />
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
