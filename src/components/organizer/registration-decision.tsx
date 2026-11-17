"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { decideRegistration } from "@/lib/registrations/actions";
import { Constants, type Enums } from "@/lib/supabase/database.types";

type Status = Enums<"registration_status">;

/**
 * Tlačítka Schválit / Zamítnout (s důvodem) / Čekací listina / Vrátit k posouzení.
 * „… a další“ po uložení rovnou otevře další přihlášku v seznamu.
 * U eventu s „odeslat najednou“ se rozhodnutí uloží jako koncept.
 */
export function RegistrationDecision({
  registrationId,
  status,
  draftStatus = null,
  holdDecisions = false,
  nextHref = null,
}: {
  registrationId: string;
  /** Skutečný stav přihlášky */
  status: Status;
  /** Neodeslaný koncept rozhodnutí */
  draftStatus?: Status | null;
  holdDecisions?: boolean;
  /** Adresa další přihlášky v seznamu (pro „… a další“) */
  nextHref?: string | null;
}) {
  const t = useTranslations("Decision");
  const tStatus = useTranslations("RegistrationStatus");
  const tReasons = useTranslations("RejectionReason");
  const tErrors = useTranslations("RegistrationErrors");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<Enums<"rejection_reason">>("criteria");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  if (status === "cancelled") {
    return <p className="text-sm text-ink-soft">{t("cancelledByApplicant")}</p>;
  }

  const shown = draftStatus ?? status;

  function decide(decision: Status, andNext = false) {
    setFeedback(null);
    startTransition(async () => {
      const result = await decideRegistration({
        registrationId,
        decision,
        reason: decision === "rejected" ? reason : undefined,
        message: decision === "rejected" ? message : undefined,
      });
      if (!result.ok) {
        setFeedback({ tone: "error", text: tErrors(result.error) });
        router.refresh();
        return;
      }
      if (andNext && nextHref) {
        router.push(nextHref);
        return;
      }
      if (!holdDecisions && decision === "approved" && result.status === "waitlist") {
        setFeedback({ tone: "info", text: t("capacityFull") });
      } else {
        setFeedback({
          tone: "success",
          text: holdDecisions && decision !== "pending" ? t("savedDraft") : t("saved"),
        });
        setRejecting(false);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {feedback ? <Alert tone={feedback.tone}>{feedback.text}</Alert> : null}
      {draftStatus ? (
        <p className="rounded-control bg-accent/20 px-3 py-2 text-sm text-ink">
          {t("draftInfo", { status: tStatus(draftStatus) })}
        </p>
      ) : holdDecisions ? (
        <p className="text-sm text-subtle">{t("holdInfo")}</p>
      ) : null}

      {rejecting ? (
        <div className="flex flex-col gap-3 rounded-control border border-line p-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t("reasonLabel")}
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as Enums<"rejection_reason">)}
              className="h-11 rounded-control border border-line bg-surface px-3 text-base focus:border-ink focus:outline-none"
            >
              {Constants.public.Enums.rejection_reason.map((r) => (
                <option key={r} value={r}>
                  {tReasons(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t("messageLabel")}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t("messagePlaceholder")}
              className="rounded-control border border-line px-4 py-3 text-base font-normal focus:border-ink focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {nextHref ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => decide("rejected", true)}
                className="h-11 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("rejectAndNext")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("rejected")}
              className={
                nextHref
                  ? "h-11 rounded-full border border-danger px-5 text-sm font-semibold text-danger disabled:opacity-50"
                  : "h-11 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50"
              }
            >
              {t("confirmReject")}
            </button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {shown !== "approved" && nextHref ? (
            <Button variant="primary" size="lg" disabled={pending} onClick={() => decide("approved", true)}>
              {t("approveAndNext")}
            </Button>
          ) : null}
          {shown !== "approved" ? (
            <Button
              variant={nextHref ? "secondary" : "primary"}
              size="lg"
              disabled={pending}
              onClick={() => decide("approved")}
            >
              {t("approve")}
            </Button>
          ) : null}
          {shown !== "rejected" ? (
            <Button variant="secondary" size="lg" disabled={pending} onClick={() => setRejecting(true)}>
              {t("reject")}
            </Button>
          ) : null}
          {shown !== "waitlist" ? (
            <Button variant="ghost" size="lg" disabled={pending} onClick={() => decide("waitlist")}>
              {t("waitlist")}
            </Button>
          ) : null}
          {shown !== "pending" ? (
            <Button variant="ghost" size="lg" disabled={pending} onClick={() => decide("pending")}>
              {draftStatus ? t("discardDraft") : t("backToPending")}
            </Button>
          ) : null}
        </div>
      )}
      {status === "approved" && !draftStatus ? <p className="text-xs text-subtle">{t("approvedHint")}</p> : null}
    </div>
  );
}
