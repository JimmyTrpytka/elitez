"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { decideCohost, removeCohost, requestCohost, type CohostErrorKey, type CohostResult } from "@/lib/cohosts/actions";
import { cn } from "@/lib/cn";

/**
 * Tlačítka pro jeden vztah „event × pořadatel“:
 * - none: požádat o spolupořádání
 * - incoming: potvrdit / odmítnout (druhá strana začala)
 * - outgoing: zrušit vlastní žádost / pozvánku
 * - accepted: ukončit spolupořádání (s potvrzením)
 */
export function CohostButtons({
  eventId,
  organizerId,
  mode,
  dark = false,
  requestLabel,
}: {
  eventId: string;
  organizerId: string;
  mode: "none" | "incoming" | "outgoing" | "accepted";
  dark?: boolean;
  requestLabel?: string;
}) {
  const t = useTranslations("Cohosts");
  const tErrors = useTranslations("CohostErrors");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<CohostErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<CohostResult>) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setConfirm(false);
        router.refresh();
      } else setError(res.error);
    });
  };

  const primary = "h-10 rounded-full bg-accent px-4 text-sm font-semibold text-ink disabled:opacity-50";
  const secondary = cn(
    "h-10 rounded-full border px-4 text-sm font-semibold disabled:opacity-50",
    dark ? "border-white/25 text-white" : "border-line text-ink",
  );
  const link = cn("text-sm font-semibold underline underline-offset-4 disabled:opacity-50", dark ? "text-white" : "text-ink");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {mode === "none" ? (
          <button type="button" disabled={pending} className={primary} onClick={() => run(() => requestCohost(eventId, organizerId))}>
            {requestLabel ?? t("request")}
          </button>
        ) : null}
        {mode === "incoming" ? (
          <>
            <button type="button" disabled={pending} className={primary} onClick={() => run(() => decideCohost(eventId, organizerId, true))}>
              {t("accept")}
            </button>
            <button type="button" disabled={pending} className={secondary} onClick={() => run(() => decideCohost(eventId, organizerId, false))}>
              {t("decline")}
            </button>
          </>
        ) : null}
        {mode === "outgoing" ? (
          <button type="button" disabled={pending} className={link} onClick={() => run(() => removeCohost(eventId, organizerId))}>
            {t("withdraw")}
          </button>
        ) : null}
        {mode === "accepted" ? (
          confirm ? (
            <>
              <span className={cn("text-sm font-semibold", dark ? "text-white" : "text-ink")}>{t("endQuestion")}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeCohost(eventId, organizerId))}
                className="h-9 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("endYes")}
              </button>
              <button type="button" className={link} onClick={() => setConfirm(false)}>
                {tCommon("cancel")}
              </button>
            </>
          ) : (
            <button type="button" className={cn(link, "text-danger")} onClick={() => setConfirm(true)}>
              {t("end")}
            </button>
          )
        ) : null}
      </div>
      {error ? <p className={cn("text-sm", dark ? "text-accent" : "text-danger")}>{tErrors(error)}</p> : null}
    </div>
  );
}
