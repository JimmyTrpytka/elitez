"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  cancelMyRegistration,
  confirmMyAttendance,
  type SimpleResult,
} from "@/lib/registrations/actions";
import { cn } from "@/lib/cn";

/** „Potvrď, že přijedeš“: Přijedu / Nepřijedu (= zrušení přihlášky, uvolní místo). */
export function AttendanceConfirm({
  registrationId,
  confirmed,
  dark = false,
}: {
  registrationId: string;
  confirmed: boolean;
  dark?: boolean;
}) {
  const t = useTranslations("Attendance");
  const tErrors = useTranslations("RegistrationErrors");
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (confirmed) {
    return (
      <p className={cn("text-sm font-semibold", dark ? "text-accent" : "text-success")}>✓ {t("confirmed")}</p>
    );
  }

  function run(action: () => Promise<SimpleResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(tErrors(result.error));
      setDeclining(false);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-control p-4",
        dark ? "bg-accent text-ink" : "border-2 border-accent bg-accent/10 text-ink",
      )}
    >
      <div>
        <p className="font-semibold">{t("title")}</p>
        <p className="text-sm">{t("hint")}</p>
      </div>
      {declining ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t("declineConfirmText")}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => cancelMyRegistration(registrationId))}
            className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("declineConfirm")}
          </button>
          <button type="button" onClick={() => setDeclining(false)} className="h-10 px-3 text-sm font-semibold underline">
            {t("back")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => confirmMyAttendance(registrationId))}
            className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("yes")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeclining(true)}
            className="h-11 rounded-full border border-ink px-5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {t("no")}
          </button>
        </div>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
