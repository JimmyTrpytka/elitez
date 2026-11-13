"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteOrganizer } from "@/lib/organizer/profile-actions";

/** Smazání omylem založeného pořadatele (jen bez eventů, potvrzení na stránce). */
export function DeleteOrganizer({ name }: { name: string }) {
  const t = useTranslations("OrganizerProfile");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<"hasEvents" | "notAllowed" | "generic" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-ink-soft">{t("deleteText")}</p>
      {error ? <Alert tone="error">{t(`deleteErrors.${error}`)}</Alert> : null}
      {confirming ? (
        <>
          <p className="font-semibold text-ink">{t("deleteQuestion", { name })}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteOrganizer(locale);
                  if (res && !res.ok) setError(res.error);
                })
              }
              className="h-11 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? tCommon("saving") : t("deleteYes")}
            </button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              {tCommon("cancel")}
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm font-semibold text-danger underline underline-offset-4"
        >
          {t("deleteButton")}
        </button>
      )}
    </div>
  );
}
