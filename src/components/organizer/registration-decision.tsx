"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { decideRegistration } from "@/lib/registrations/actions";
import { Constants, type Enums } from "@/lib/supabase/database.types";

type Status = Enums<"registration_status">;

/** Tlačítka Schválit / Zamítnout (s důvodem) / Čekací listina / Vrátit k posouzení. */
export function RegistrationDecision({
  registrationId,
  status,
}: {
  registrationId: string;
  status: Status;
}) {
  const t = useTranslations("Decision");
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

  function decide(decision: Status) {
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
      } else if (decision === "approved" && result.status === "waitlist") {
        setFeedback({ tone: "info", text: t("capacityFull") });
      } else {
        setFeedback({ tone: "success", text: t("saved") });
        setRejecting(false);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {feedback ? <Alert tone={feedback.tone}>{feedback.text}</Alert> : null}

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
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("rejected")}
              className="h-11 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50"
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
          {status !== "approved" ? (
            <Button variant="primary" size="lg" disabled={pending} onClick={() => decide("approved")}>
              {t("approve")}
            </Button>
          ) : null}
          {status !== "rejected" ? (
            <Button variant="secondary" size="lg" disabled={pending} onClick={() => setRejecting(true)}>
              {t("reject")}
            </Button>
          ) : null}
          {status !== "waitlist" ? (
            <Button variant="ghost" size="lg" disabled={pending} onClick={() => decide("waitlist")}>
              {t("waitlist")}
            </Button>
          ) : null}
          {status !== "pending" ? (
            <Button variant="ghost" size="lg" disabled={pending} onClick={() => decide("pending")}>
              {t("backToPending")}
            </Button>
          ) : null}
        </div>
      )}
      {status === "approved" ? <p className="text-xs text-subtle">{t("approvedHint")}</p> : null}
    </div>
  );
}
