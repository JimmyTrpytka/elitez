"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptPromoConsent } from "@/lib/consent-actions";
import { signOut } from "@/lib/auth/actions";

/** Jednorázové okno s povinným souhlasem (na stránce Ochrana údajů se nezobrazí). */
export function PromoConsentModal() {
  const t = useTranslations("PromoConsent");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done || pathname === "/privacy") return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-consent-title"
        className="flex max-h-[90svh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-card bg-surface p-6 text-ink shadow-2xl sm:p-8"
      >
        <p id="promo-consent-title" className="font-display text-3xl font-extrabold uppercase">
          {t("title")}
        </p>
        <p className="text-ink-soft">{t("intro")}</p>
        <label className="flex items-start gap-3 rounded-control bg-muted p-4 text-sm text-ink">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span className="font-medium">{t("label")}</span>
        </label>
        <p className="text-xs text-subtle">
          {t("more")}{" "}
          <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
            {t("privacyLink")}
          </Link>
        </p>
        {failed ? <Alert tone="error">{t("failed")}</Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!checked || pending}
            onClick={() =>
              startTransition(async () => {
                const res = await acceptPromoConsent();
                if (res.ok) {
                  setDone(true);
                  router.refresh();
                } else setFailed(true);
              })
            }
          >
            {t("accept")}
          </Button>
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-sm font-semibold text-ink-soft underline underline-offset-4">
              {t("logout")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
