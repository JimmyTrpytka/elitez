"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteDraftEvent, duplicateEvent, setEventStatus } from "@/lib/organizer/actions";
import type { Enums } from "@/lib/supabase/database.types";

type Status = Enums<"event_status">;

/** Změna stavu eventu, duplikace a smazání konceptu. */
export function EventStatusPanel({ eventId, status }: { eventId: string; status: Status }) {
  const t = useTranslations("Organizer");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState<null | "cancel" | "delete">(null);

  function run(fn: () => Promise<{ ok: boolean }>) {
    setError(false);
    setConfirm(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(true);
      router.refresh();
    });
  }

  const to = (s: Status) => () => run(() => setEventStatus(eventId, s));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">{t(`statusHelp.${status}`)}</p>
      {error ? <Alert tone="error">{t("actionFailed")}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <Button variant="primary" disabled={pending} onClick={to("published")}>
            {t("publish")}
          </Button>
        ) : null}
        {status === "published" ? (
          <>
            <Button variant="secondary" disabled={pending} onClick={to("closed")}>
              {t("close")}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={to("draft")}>
              {t("unpublish")}
            </Button>
          </>
        ) : null}
        {status === "closed" ? (
          <Button variant="secondary" disabled={pending} onClick={to("published")}>
            {t("reopen")}
          </Button>
        ) : null}
        {status === "cancelled" ? (
          <Button variant="secondary" disabled={pending} onClick={to("published")}>
            {t("restore")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => duplicateEvent(eventId, locale))}
        >
          {t("duplicate")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {status !== "draft" && status !== "cancelled" ? (
          confirm === "cancel" ? (
            <>
              <span className="text-sm text-ink">{t("cancelConfirmText")}</span>
              <button
                type="button"
                disabled={pending}
                onClick={to("cancelled")}
                className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white"
              >
                {t("cancelConfirm")}
              </button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {tCommon("cancel")}
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("cancel")}
              className="text-sm font-semibold text-danger underline underline-offset-4"
            >
              {t("cancelEvent")}
            </button>
          )
        ) : null}
        {status === "draft" ? (
          confirm === "delete" ? (
            <>
              <span className="text-sm text-ink">{t("deleteConfirmText")}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteDraftEvent(eventId, locale))}
                className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white"
              >
                {t("deleteConfirm")}
              </button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {tCommon("cancel")}
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("delete")}
              className="text-sm font-semibold text-danger underline underline-offset-4"
            >
              {t("deleteDraft")}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
