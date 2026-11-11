"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cancelMyRegistration } from "@/lib/registrations/actions";
import { Button } from "@/components/ui/button";

/** Zrušení vlastní přihlášky (s potvrzením). */
export function CancelRegistrationButton({ registrationId }: { registrationId: string }) {
  const t = useTranslations("Registration");
  const tErrors = useTranslations("RegistrationErrors");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="text-sm font-semibold text-danger underline underline-offset-4"
      >
        {t("cancel")}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink">{t("cancelConfirmText")}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelMyRegistration(registrationId);
            if (!result.ok) setError(tErrors(result.error));
            setConfirm(false);
            router.refresh();
          })
        }
        className="h-9 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {t("cancelConfirm")}
      </button>
      <Button variant="ghost" onClick={() => setConfirm(false)}>
        {tCommon("cancel")}
      </Button>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}
