"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { releaseDecisions } from "@/lib/registrations/actions";
import { Button } from "@/components/ui/button";

/** Lišta „Neodeslaná rozhodnutí: N → Odeslat všem“ (dvoukrokové potvrzení). */
export function ReleaseDecisions({ eventId, drafts }: { eventId: string; drafts: number }) {
  const t = useTranslations("Applications");
  const tErrors = useTranslations("RegistrationErrors");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function release() {
    startTransition(async () => {
      const result = await releaseDecisions(eventId);
      setConfirm(false);
      setMessage(
        result.ok
          ? { ok: true, text: t("releaseDone", { count: result.count }) }
          : { ok: false, text: tErrors(result.error) },
      );
      router.refresh();
    });
  }

  if (drafts === 0) {
    return message ? (
      <p className={message.ok ? "mb-6 text-sm font-semibold text-success" : "mb-6 text-sm text-danger"}>
        {message.text}
      </p>
    ) : null;
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-card bg-accent p-4 text-ink sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{t("draftsTitle", { count: drafts })}</p>
        <p className="text-sm">{t("draftsHint")}</p>
        {message && !message.ok ? <p className="mt-1 text-sm text-danger">{message.text}</p> : null}
      </div>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t("releaseConfirmText", { count: drafts })}</span>
          <Button variant="secondary" disabled={pending} onClick={release}>
            {pending ? t("releasing") : t("releaseConfirm")}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>
            {tCommon("cancel")}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="lg" onClick={() => setConfirm(true)}>
          {t("release")}
        </Button>
      )}
    </div>
  );
}
